# Google Colab AutoCrop Worker

This notebook acts as a GPU worker that processes video autocrop jobs from your Easy-Edits application.

## How it Works

1. **Website uploads video** → Stores in Cloudflare R2, creates job in Firebase Firestore
2. **This notebook polls** → Finds pending jobs in Firestore
3. **Downloads & processes** → Gets video from R2, runs AutoCrop with GPU
4. **Uploads result** → Stores cropped video back to R2, marks job complete
5. **Website displays** → Polls for completion, shows result video

## Setup Instructions

### 1. Get Your Credentials

You need two sets of credentials:

**Firebase Service Account:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project → Project Settings → Service accounts
3. Click "Generate new private key"
4. Copy the entire JSON content

**Cloudflare R2 Credentials:**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to R2 → Manage R2 API Tokens
3. Create a token with Object Read & Write permissions
4. Copy: Access Key ID, Secret Access Key, Account ID, Bucket Name

Store them as [Colab Secrets](https://colab.research.google.com/) (key icon in the
left sidebar) named `FIREBASE_CREDENTIALS`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY` and `R2_BUCKET_NAME`. Never paste keys into notebook cells.

### 2. Run the Setup Cells

Run each cell in order. The notebook will:

- Install required packages
- Read your credentials from Colab Secrets
- Start the worker loop

### 3. Keep the Notebook Running

The worker will continuously poll for new jobs. Leave it running while you process videos.

---

## Notebook Cells

Copy each section below into separate cells in your Colab notebook:

---

### Cell 1: Install Dependencies

```python
# Install required packages
!pip install -q ultralytics opencv-python firebase-admin boto3 scenedetect tqdm numpy

# For GPU acceleration
import torch
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
```

---

### Cell 2: Configure Credentials

```python
import json
from google.colab import userdata

# Credentials are read from Colab's Secrets panel (key icon in the left sidebar).
# Add these secrets and grant this notebook access to them:
#   FIREBASE_CREDENTIALS  - the full Firebase service-account JSON
#   R2_ENDPOINT           - https://<account-id>.r2.cloudflarestorage.com
#   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
FIREBASE_CREDENTIALS = userdata.get('FIREBASE_CREDENTIALS')

R2_CONFIG = {
    "endpoint": userdata.get('R2_ENDPOINT'),
    "access_key_id": userdata.get('R2_ACCESS_KEY_ID'),
    "secret_access_key": userdata.get('R2_SECRET_ACCESS_KEY'),
    "bucket_name": userdata.get('R2_BUCKET_NAME'),
}

# Parse Firebase credentials
firebase_creds = json.loads(FIREBASE_CREDENTIALS)
print("✅ All credentials configured!")
print(f"   Firebase Project: {firebase_creds['project_id']}")
print(f"   R2 Bucket: {R2_CONFIG['bucket_name']}")
```

---

### Cell 3: Initialize Services

```python
import firebase_admin
from firebase_admin import credentials, firestore
import boto3
from botocore.config import Config

# Initialize Firebase
if not firebase_admin._apps:
    cred = credentials.Certificate(firebase_creds)
    firebase_admin.initialize_app(cred)

db = firestore.client()
print("✅ Firebase Firestore connected")

# Initialize R2 (S3-compatible)
r2_client = boto3.client(
    's3',
    endpoint_url=R2_CONFIG['endpoint'],
    aws_access_key_id=R2_CONFIG['access_key_id'],
    aws_secret_access_key=R2_CONFIG['secret_access_key'],
    config=Config(signature_version='s3v4'),
    region_name='auto'
)

# Test R2 connection
try:
    r2_client.list_objects_v2(Bucket=R2_CONFIG['bucket_name'], MaxKeys=1)
    print("✅ Cloudflare R2 connected")
except Exception as e:
    print(f"❌ R2 connection failed: {e}")
```

---

### Cell 4: AutoCrop Functions

```python
import cv2
import numpy as np
from ultralytics import YOLO
from scenedetect import VideoManager, SceneManager
from scenedetect.detectors import ContentDetector
import subprocess
import os
from tqdm import tqdm

# Constants
ASPECT_RATIO = 9 / 16
SAMPLES_PER_SCENE = 5

# Load YOLO model (will use GPU if available)
model = YOLO('yolov8n.pt')
print(f"✅ YOLO model loaded on: {model.device}")

def analyze_scene_movement(video_path, start_frame, end_frame):
    """Analyze multiple frames in a scene to track person movement."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []

    sample_indices = np.linspace(start_frame, end_frame - 1, SAMPLES_PER_SCENE, dtype=int)
    all_detected_boxes = []

    for idx in sample_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if not ret:
            continue

        results = model([frame], verbose=False)
        for result in results:
            for box in result.boxes:
                if box.cls[0] == 0:  # Person class
                    all_detected_boxes.append([int(i) for i in box.xyxy[0]])

    cap.release()
    return all_detected_boxes

def detect_scenes(video_path):
    """Detect scene changes in video."""
    video_manager = VideoManager([video_path])
    scene_manager = SceneManager()
    scene_manager.add_detector(ContentDetector())
    video_manager.set_downscale_factor()
    video_manager.start()
    scene_manager.detect_scenes(frame_source=video_manager)
    scene_list = scene_manager.get_scene_list()
    fps = video_manager.get_framerate()
    video_manager.release()
    return scene_list, fps

def get_super_box(boxes):
    """Get bounding box that encloses all detections."""
    if not boxes:
        return None
    min_x = min(box[0] for box in boxes)
    min_y = min(box[1] for box in boxes)
    max_x = max(box[2] for box in boxes)
    max_y = max(box[3] for box in boxes)
    return [min_x, min_y, max_x, max_y]

def decide_cropping_strategy(all_boxes, frame_width, frame_height):
    """Decide whether to track or letterbox."""
    if not all_boxes:
        return 'LETTERBOX', None

    super_box = get_super_box(all_boxes)
    sb_width = super_box[2] - super_box[0]
    max_allowed_width = frame_height * ASPECT_RATIO

    if sb_width > max_allowed_width:
        return 'LETTERBOX', None
    else:
        return 'TRACK', super_box

def calculate_crop_box(target_box, frame_width, frame_height):
    """Calculate crop coordinates centered on target."""
    target_center_x = (target_box[0] + target_box[2]) / 2
    crop_height = frame_height
    crop_width = int(crop_height * ASPECT_RATIO)

    x1 = int(target_center_x - crop_width / 2)
    x2 = x1 + crop_width

    if x1 < 0:
        x1 = 0
        x2 = crop_width
    if x2 > frame_width:
        x2 = frame_width
        x1 = frame_width - crop_width

    return x1, 0, x2, frame_height

def process_video(input_path, output_path, progress_callback=None):
    """Main autocrop processing function."""
    print(f"🎬 Processing: {input_path}")

    # Detect scenes
    print("Step 1: Detecting scenes...")
    scenes, fps = detect_scenes(input_path)

    cap = cv2.VideoCapture(input_path)
    original_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    original_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()

    OUTPUT_HEIGHT = original_height
    OUTPUT_WIDTH = int(OUTPUT_HEIGHT * ASPECT_RATIO)
    if OUTPUT_WIDTH % 2 != 0:
        OUTPUT_WIDTH += 1

    # Analyze scenes
    print("Step 2: Analyzing movement paths...")
    scenes_analysis = []
    for i, (start_time, end_time) in enumerate(tqdm(scenes, desc="Tracking")):
        all_detections = analyze_scene_movement(
            input_path,
            start_time.get_frames(),
            end_time.get_frames()
        )
        strategy, super_box = decide_cropping_strategy(
            all_detections, original_width, original_height
        )
        scenes_analysis.append({
            'start_frame': start_time.get_frames(),
            'end_frame': end_time.get_frames(),
            'strategy': strategy,
            'target_box': super_box
        })

    # Process video
    print("Step 3: Processing video...")
    temp_video = output_path.replace('.mp4', '_temp_v.mp4')
    temp_audio = output_path.replace('.mp4', '_temp_a.mka')

    command = [
        'ffmpeg', '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo',
        '-s', f'{OUTPUT_WIDTH}x{OUTPUT_HEIGHT}', '-pix_fmt', 'bgr24',
        '-r', str(fps), '-i', '-', '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',  # Required for browser compatibility
        '-preset', 'fast', '-crf', '18', '-an', temp_video
    ]

    ffmpeg_process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    cap = cv2.VideoCapture(input_path)

    current_scene_idx = 0

    for f_idx in tqdm(range(total_frames), desc="Applying Crop"):
        ret, frame = cap.read()
        if not ret:
            break

        if current_scene_idx < len(scenes_analysis) - 1 and \
           f_idx >= scenes_analysis[current_scene_idx + 1]['start_frame']:
            current_scene_idx += 1

        scene_data = scenes_analysis[current_scene_idx]

        if scene_data['strategy'] == 'TRACK':
            x1, y1, x2, y2 = calculate_crop_box(
                scene_data['target_box'], original_width, original_height
            )
            output_frame = frame[y1:y2, x1:x2]
            if output_frame.shape[1] != OUTPUT_WIDTH:
                output_frame = cv2.resize(output_frame, (OUTPUT_WIDTH, OUTPUT_HEIGHT))
        else:
            scale = OUTPUT_WIDTH / original_width
            nh = int(original_height * scale)
            scaled = cv2.resize(frame, (OUTPUT_WIDTH, nh))
            output_frame = np.zeros((OUTPUT_HEIGHT, OUTPUT_WIDTH, 3), dtype=np.uint8)
            y_off = (OUTPUT_HEIGHT - nh) // 2
            output_frame[y_off:y_off+nh, :] = scaled

        ffmpeg_process.stdin.write(output_frame.tobytes())

        if progress_callback and f_idx % 30 == 0:
            progress = int((f_idx / total_frames) * 100)
            progress_callback(progress)

    ffmpeg_process.stdin.close()
    ffmpeg_process.wait()
    cap.release()

    # Add audio
    print("Step 4: Finalizing audio...")
    subprocess.run(['ffmpeg', '-y', '-i', input_path, '-vn', '-acodec', 'copy', temp_audio],
                   stderr=subprocess.PIPE)
    subprocess.run(['ffmpeg', '-y', '-i', temp_video, '-i', temp_audio, '-c', 'copy', output_path],
                   stderr=subprocess.PIPE)

    # Cleanup
    if os.path.exists(temp_video):
        os.remove(temp_video)
    if os.path.exists(temp_audio):
        os.remove(temp_audio)

    print(f"✅ Done! Output: {output_path}")
    return output_path

print("✅ AutoCrop functions loaded")
```

---

### Cell 5: Worker Functions

```python
import time

def download_from_r2(key, local_path):
    """Download file from R2 to local path."""
    print(f"⬇️ Downloading: {key}")
    r2_client.download_file(R2_CONFIG['bucket_name'], key, local_path)
    print(f"✅ Downloaded to: {local_path}")

def upload_to_r2(local_path, key):
    """Upload file from local path to R2."""
    print(f"⬆️ Uploading: {key}")
    r2_client.upload_file(local_path, R2_CONFIG['bucket_name'], key)
    print(f"✅ Uploaded to: {key}")

def update_job_status(job_id, status, **kwargs):
    """Update job status in Firestore."""
    update_data = {
        'status': status,
        'updatedAt': firestore.SERVER_TIMESTAMP,
        **kwargs
    }
    db.collection('jobs').document(job_id).update(update_data)
    print(f"📝 Job {job_id[:8]}... status: {status}")

def get_pending_jobs():
    """Get list of pending jobs from Firestore."""
    # Simple query - no orderBy to avoid needing a composite index
    jobs = db.collection('jobs')\
        .where(filter=firestore.FieldFilter('status', '==', 'pending'))\
        .limit(5)\
        .get()
    return [job.to_dict() for job in jobs]

def process_job(job):
    """Process a single job."""
    job_id = job['id']
    input_key = job['inputVideoKey']
    aspect_ratio = job.get('aspectRatio', '9:16')

    print(f"\n{'='*50}")
    print(f"🎬 Processing job: {job_id}")
    print(f"   Input: {input_key}")
    print(f"   Aspect Ratio: {aspect_ratio}")
    print(f"{'='*50}\n")

    try:
        # Mark as processing
        update_job_status(job_id, 'processing')

        # Create temp directory
        os.makedirs('/content/temp', exist_ok=True)

        # Download input
        input_path = f'/content/temp/input_{job_id}.mp4'
        download_from_r2(input_key, input_path)

        # Process
        output_path = f'/content/temp/output_{job_id}.mp4'

        def progress_callback(progress):
            update_job_status(job_id, 'processing', progress=progress)

        process_video(input_path, output_path, progress_callback)

        # Upload result
        output_key = f"outputs/cropped_{job_id}.mp4"
        upload_to_r2(output_path, output_key)

        # Mark as completed
        update_job_status(job_id, 'completed',
                         outputVideoKey=output_key,
                         progress=100)

        # Cleanup local files
        if os.path.exists(input_path):
            os.remove(input_path)
        if os.path.exists(output_path):
            os.remove(output_path)

        print(f"✅ Job {job_id[:8]}... completed!")
        return True

    except Exception as e:
        print(f"❌ Job {job_id[:8]}... failed: {e}")
        update_job_status(job_id, 'failed', error=str(e))
        return False

print("✅ Worker functions loaded")
```

---

### Cell 6: Run Worker Loop

```python
# Run the worker loop
POLL_INTERVAL = 10  # seconds between polls

print("🚀 Starting worker loop...")
print("   Polling for jobs every", POLL_INTERVAL, "seconds")
print("   Press STOP (⏹️) to stop the worker\n")

job_count = 0

while True:
    try:
        jobs = get_pending_jobs()

        if jobs:
            print(f"📥 Found {len(jobs)} pending job(s)")
            for job in jobs:
                process_job(job)
                job_count += 1
        else:
            print(f"💤 No pending jobs. Total processed: {job_count}. Waiting...")

        time.sleep(POLL_INTERVAL)

    except KeyboardInterrupt:
        print("\n⏹️ Worker stopped by user")
        break
    except Exception as e:
        print(f"❌ Error in worker loop: {e}")
        time.sleep(POLL_INTERVAL)
```

---

## Troubleshooting

### "Module not found" errors

Run Cell 1 again to reinstall packages.

### "Firebase not initialized"

Make sure you ran Cell 2 and Cell 3 in order.

### "R2 connection failed"

Double-check your R2 credentials - especially the endpoint URL format.

### "CUDA not available"

1. Go to Runtime → Change runtime type
2. Select GPU (T4, P100, or V100)
3. Restart and run all cells again

### Jobs stuck in "pending"

Make sure the worker loop (Cell 6) is running and showing "Found X pending job(s)".
