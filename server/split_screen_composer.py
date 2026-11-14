#!/usr/bin/env python3
"""
Split Screen Video Composer
Creates a dynamic video that switches between:
- Full-screen 9:16 video (during seconds 0-5 of each interval)
- 65/35 split with AI image slideshow (during seconds 5-10 of each interval)
"""

import argparse
import json
import os
import subprocess
import sys


def get_video_info(video_path):
    """Get video duration and dimensions using ffprobe."""
    cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", video_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"ffprobe failed: {result.stderr}")

    info = json.loads(result.stdout)

    video_stream = None
    for stream in info.get("streams", []):
        if stream.get("codec_type") == "video":
            video_stream = stream
            break

    if not video_stream:
        raise Exception("No video stream found")

    duration = float(info["format"]["duration"])
    width = int(video_stream["width"])
    height = int(video_stream["height"])

    return duration, width, height


def create_split_screen_video(input_video, output_video, images_data, transition, zoom, captions_path=None):
    """
    Create video with dynamic split-screen effect:
    - Seconds 0-5: Full-screen original video (9:16)
    - Seconds 5-10: 65/35 split with images on bottom
    - Pattern repeats every 10 seconds
    """

    # Get video info
    duration, orig_width, orig_height = get_video_info(input_video)
    print(f"📹 Video: {duration:.2f}s, {orig_width}x{orig_height}")

    # Output dimensions (9:16 aspect ratio)
    output_width = 1080
    output_height = 1920
    top_height = int(output_height * 0.65)  # 65% = 1248px
    bottom_height = output_height - top_height  # 35% = 672px

    print(f"📐 Output: {output_width}x{output_height}")
    print("   Full-screen: 0-5s, 10-15s, 20-25s, ...")
    print("   Split 65/35: 5-10s, 15-20s, 25-30s, ...")

    # Load images data
    with open(images_data) as f:
        images = json.load(f)

    print(f"🖼️  Processing {len(images)} images...")

    # Build input list
    inputs = ["-i", input_video]
    valid_images = []
    for img in images:
        img_path = img.get("localPath", "")
        if os.path.exists(img_path):
            inputs.extend(["-i", img_path])
            valid_images.append(img)
        else:
            print(f"⚠️  Image not found: {img_path}")

    # Group images by their time segment
    segments = {}
    for img in valid_images:
        key = (img["timeStart"], img["timeEnd"])
        if key not in segments:
            segments[key] = []
        segments[key].append(img)

    sorted_segments = sorted(segments.items(), key=lambda x: x[0][0])

    # Build filter complex
    filter_parts = []

    # Create full-screen version of video (scaled to 9:16)
    filter_parts.append(
        f"[0:v]scale={output_width}:{output_height}:force_original_aspect_ratio=decrease,"
        f"pad={output_width}:{output_height}:(ow-iw)/2:(oh-ih)/2[fullscreen]"
    )

    # Create split-screen top portion (65%)
    filter_parts.append(
        f"[0:v]scale={output_width}:{top_height}:force_original_aspect_ratio=decrease,"
        f"pad={output_width}:{top_height}:(ow-iw)/2:(oh-ih)/2[split_top]"
    )

    # Create black background for bottom portion
    filter_parts.append(f"color=black:{output_width}x{bottom_height}:d={duration}[bottom_bg]")

    # Stack top video and bottom background for split view
    filter_parts.append("[split_top][bottom_bg]vstack=inputs=2[split_base]")

    # Process each image and add overlay to split_base
    overlay_chain = "[split_base]"
    input_index = 1

    for (start_time, end_time), segment_images in sorted_segments:
        # Images show from second 5 to 10 of the interval
        show_start = start_time + 5
        show_end = min(start_time + 10, end_time, duration)

        if show_start >= duration:
            continue

        segment_duration = show_end - show_start
        if segment_duration <= 0:
            continue

        num_images = len(segment_images)
        time_per_image = segment_duration / num_images

        for i, _img in enumerate(segment_images):
            img_start = show_start + (i * time_per_image)
            img_end = show_start + ((i + 1) * time_per_image)

            # Build zoom/pan effect for the image
            fps = 25
            frames = max(1, int(time_per_image * fps))

            if zoom == "ken_burns":
                zoom_filter = (
                    f"scale={int(output_width * 1.2)}:{int(bottom_height * 1.2)},"
                    f"zoompan=z='1.1':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={output_width}x{bottom_height}:fps={fps}"
                )
            elif zoom == "zoom_in":
                zoom_filter = (
                    f"scale={output_width}:{bottom_height},"
                    f"zoompan=z='zoom+0.002':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={output_width}x{bottom_height}:fps={fps}"
                )
            elif zoom == "zoom_out":
                zoom_filter = (
                    f"scale={int(output_width * 1.4)}:{int(bottom_height * 1.4)},"
                    f"zoompan=z='1.4-in*0.004':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={output_width}x{bottom_height}:fps={fps}"
                )
            else:
                zoom_filter = (
                    f"scale={output_width}:{bottom_height}:force_original_aspect_ratio=decrease,"
                    f"pad={output_width}:{bottom_height}:(ow-iw)/2:(oh-ih)/2"
                )

            # Add fade effect
            fade_filter = ""
            if transition == "fade":
                fade_duration = min(0.3, time_per_image / 4)
                fade_filter = f",fade=t=in:st=0:d={fade_duration}"

            # Process image
            filter_parts.append(f"[{input_index}:v]{zoom_filter}{fade_filter},setpts=PTS-STARTPTS[img{input_index}]")

            # Overlay image on split_base at bottom portion
            enable_expr = f"between(t,{img_start},{img_end})"
            new_overlay = f"[ovr{input_index}]"

            filter_parts.append(
                f"{overlay_chain}[img{input_index}]overlay=0:{top_height}:enable='{enable_expr}'{new_overlay}"
            )

            overlay_chain = new_overlay
            input_index += 1

    # Now we have [fullscreen] and a split-base with images ({overlay_chain})
    # We need to switch between them based on time

    if overlay_chain == "[split_base]":
        split_with_images = "[split_base]"
    else:
        split_with_images = overlay_chain

    # Build the time-based switching expression
    # During seconds 0-5, 10-15, 20-25... show fullscreen
    # During seconds 5-10, 15-20, 25-30... show split
    # Formula: if (floor(t/5) % 2 == 0) then fullscreen else split

    # We use overlay with enable expression to switch
    # First, create a version that switches: fullscreen during 0-5, split during 5-10, etc.

    # Method: Overlay split on top of fullscreen, enable only during split times
    # split_times: 5-10, 15-20, 25-30, etc.
    split_enable_parts = []
    for i in range(0, int(duration) + 10, 10):
        split_start = i + 5
        split_end = min(i + 10, duration)
        if split_start < duration:
            split_enable_parts.append(f"between(t,{split_start},{split_end})")

    split_enable_expr = "+".join(split_enable_parts) if split_enable_parts else "0"

    # Overlay the split version on fullscreen, enabled during split times
    filter_parts.append(f"[fullscreen]{split_with_images}overlay=0:0:enable='{split_enable_expr}'[outv]")

    filter_complex = ";".join(filter_parts)

    # Build ffmpeg command
    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        filter_complex,
        "-map",
        "[outv]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-shortest",
        output_video,
    ]

    print("🎬 Running FFmpeg...")
    print(f"Command preview: {' '.join(cmd[:15])}...")

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print("❌ FFmpeg failed:")
        print(result.stderr[-2000:] if len(result.stderr) > 2000 else result.stderr)
        raise Exception("FFmpeg failed")

    print(f"✅ Created: {output_video}")
    return output_video


def main():
    parser = argparse.ArgumentParser(description="Create dynamic split-screen video with AI images")
    parser.add_argument("--input", required=True, help="Input video path")
    parser.add_argument("--output", required=True, help="Output video path")
    parser.add_argument("--images-data", required=True, help="JSON file with images data")
    parser.add_argument(
        "--transition",
        default="fade",
        choices=["fade", "wipe", "zoom", "none"],
        help="Transition effect between images",
    )
    parser.add_argument(
        "--zoom", default="none", choices=["ken_burns", "zoom_in", "zoom_out", "none"], help="Zoom effect on images"
    )
    parser.add_argument("--captions", help="Optional SRT captions file path")

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"❌ Input video not found: {args.input}")
        sys.exit(1)

    if not os.path.exists(args.images_data):
        print(f"❌ Images data file not found: {args.images_data}")
        sys.exit(1)

    try:
        create_split_screen_video(args.input, args.output, args.images_data, args.transition, args.zoom, args.captions)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
