# Music Video Job Processing for Easy-Edits Colab Worker
# Add this code to the worker functions cell in the Colab notebook

# New function to get music video jobs
def get_music_jobs():
    """Get music video jobs waiting for processing."""
    jobs = (
        db.collection("jobs")
        .where(filter=FieldFilter("type", "==", "music_video"))
        .where(filter=FieldFilter("status", "==", "pending"))
        .limit(5)
        .get()
    )
    return [job.to_dict() for job in jobs]


def process_music_job(job):
    """Process music video job: YOLO autocrop + filter + transcription + captions."""
    job_id = job["id"]
    input_key = job["inputVideoKey"]
    filter_name = job.get("filter")
    caption_style = job.get("captionStyle")
    caption_settings = {
        "font": job.get("captionFont", "montserrat"),
        "color": job.get("captionColor", "white"),
        "highlightColor": job.get("captionColor", "yellow"),
        "wordsPerSegment": 4,
        "position": job.get("captionPosition", "bottom"),
        "customPositionY": job.get("captionSize", 85),  # Using captionSize as fallback for custom Y position
    }

    print(f"\n{'=' * 50}\n🎵 Processing music job: {job_id}\n{'=' * 50}")
    print(f"   Filter: {filter_name or 'none'}")
    print(f"   Caption: {caption_style or 'none'}")

    try:
        update_job_status(job_id, "processing")
        os.makedirs("/content/temp", exist_ok=True)

        # Step 1: Download input video
        input_path = f"/content/temp/input_{job_id}.mp4"
        download_from_r2(input_key, input_path)

        # Step 2: YOLO Autocrop (9:16) - keeps person in frame
        print("\n🎬 Step 1: YOLO Autocrop (keeping person in frame)...")
        cropped_path = f"/content/temp/cropped_{job_id}.mp4"
        process_video(input_path, cropped_path, lambda p: update_job_status(job_id, "processing", progress=p * 0.4))

        # Step 3: Apply filter if selected
        current_path = cropped_path
        if filter_name:
            print(f"\n🎨 Step 2: Applying filter '{filter_name}'...")
            filtered_path = f"/content/temp/filtered_{job_id}.mp4"
            # Map filter names to FFmpeg commands
            filter_map = {
                "vhs": "colorbalance=rs=0.3:gs=-0.05:bs=-0.1,noise=alls=20",
                "dreamy": "gblur=sigma=1.5,eq=brightness=0.1:saturation=0.85",
                "y2k": "eq=saturation=1.4:contrast=1.2",
                "cinematic": "eq=contrast=1.3:saturation=0.9",
                "coquette": "colorbalance=rs=0.2:gs=-0.05:bs=0.1,gblur=sigma=0.5",
                "lofi": "eq=saturation=0.7:contrast=0.9:brightness=-0.05",
                "film_grain": "noise=alls=15:allf=t,eq=saturation=0.9:contrast=1.1",
                "neon_glow": "eq=saturation=1.8:contrast=1.3",
                "warm_glow": "colorbalance=rs=0.2:gs=0.1:bs=-0.1,eq=brightness=0.05",
                "cool_tones": "colorbalance=rs=-0.15:gs=0:bs=0.2,eq=saturation=0.95",
            }
            ffmpeg_filter = filter_map.get(filter_name, "")
            if ffmpeg_filter:
                subprocess.run(
                    ["ffmpeg", "-y", "-i", current_path, "-vf", ffmpeg_filter, "-c:a", "copy", filtered_path],
                    stderr=subprocess.DEVNULL,
                )
                current_path = filtered_path

        # Step 4: Transcribe with Whisper
        print("\n🎤 Step 3: Transcribing audio with Whisper...")
        update_job_status(job_id, "transcribing", progress=60)
        transcription = transcribe_video(current_path)

        # Step 5: Generate and burn captions
        output_path = f"/content/temp/output_{job_id}.mp4"
        if caption_style and transcription.get("words"):
            print("\n📝 Step 4: Burning captions...")
            ass_path = f"/content/temp/captions_{job_id}.ass"
            generate_ass_subtitles(transcription, ass_path, caption_settings)
            burn_captions(current_path, output_path, ass_path)
            if os.path.exists(ass_path):
                os.remove(ass_path)
        else:
            import shutil

            shutil.copy(current_path, output_path)

        # Step 6: Upload to R2
        print("\n⬆️ Step 5: Uploading result...")
        output_key = f"outputs/music_{job_id}.mp4"
        upload_to_r2(output_path, output_key)

        update_job_status(job_id, "completed", outputVideoKey=output_key, progress=100, transcription=transcription)

        # Cleanup
        for f in [input_path, cropped_path, current_path, output_path]:
            if os.path.exists(f):
                os.remove(f)

        print("✅ Music video job completed!")
        return True
    except Exception as e:
        print(f"❌ Failed: {e}")
        import traceback

        traceback.print_exc()
        update_job_status(job_id, "failed", error=str(e))
        return False


# ============================================
# Updated Worker Loop - Add this to Cell 8
# ============================================
# Replace the existing worker loop with this:
"""
POLL_INTERVAL = 10

print("🚀 Starting Easy-Edits Worker...")
print(f"   YOLO Model: {YOLO_MODEL} (Stabilized Detection)")
print(f"   Whisper Model: {WHISPER_MODEL} (Transcription)")
print(f"   Smoothing: {SMOOTHING_WINDOW_SIZE} frames")
print(f"   Polling every {POLL_INTERVAL}s. Press STOP to stop.\n")

job_count = 0
caption_count = 0
music_count = 0  # NEW: Track music video jobs

while True:
    try:
        # Check for autocrop jobs
        jobs = get_pending_jobs()
        if jobs:
            print(f"📥 Found {len(jobs)} autocrop job(s)")
            for job in jobs:
                process_job(job)
                job_count += 1
        
        # Check for caption jobs
        caption_jobs = get_caption_jobs()
        if caption_jobs:
            print(f"📥 Found {len(caption_jobs)} caption job(s)")
            for job in caption_jobs:
                process_caption_job(job)
                caption_count += 1
        
        # NEW: Check for music video jobs
        music_jobs = get_music_jobs()
        if music_jobs:
            print(f"🎵 Found {len(music_jobs)} music video job(s)")
            for job in music_jobs:
                process_music_job(job)
                music_count += 1
        
        if not jobs and not caption_jobs and not music_jobs:
            print(f"💤 No jobs. Autocrop: {job_count}, Captions: {caption_count}, Music: {music_count}. Waiting...")
        
        time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        print("\n⏹️ Stopped")
        break
    except Exception as e:
        print(f"❌ Error: {e}")
        time.sleep(POLL_INTERVAL)
"""
