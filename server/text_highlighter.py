#!/usr/bin/env python3
"""
Text Highlighter - Creates viral "documentary style" highlight animations
from uploaded screenshots using OCR and MoviePy.

Usage:
    python text_highlighter.py --image_path <path> --target_text <text> --output <output.mp4>
"""

import argparse
import json
import os
import re
import sys
from difflib import SequenceMatcher

import cv2
import easyocr
import numpy as np


class TextHighlighter:
    """OCR-based text highlighter with animated reveal."""

    def __init__(self):
        """Initialize the EasyOCR reader (loads model once)."""
        print("Initializing EasyOCR reader...", file=sys.stderr)
        self.reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        print("EasyOCR ready.", file=sys.stderr)

    def find_text_coordinates(self, image_path: str, target_text: str) -> list:
        """
        Scan image and return bounding boxes for the specific phrase.
        Uses strict matching to find exactly the requested text.
        """
        print(f"Scanning image: {image_path}", file=sys.stderr)
        result = self.reader.readtext(image_path)

        # Clean target text
        target_clean = target_text.lower().strip()
        target_no_punct = re.sub(r"[^\w\s]", "", target_clean).strip()

        print("\n=== OCR DEBUG ===", file=sys.stderr)
        print(f"Target text: '{target_text}'", file=sys.stderr)
        print(f"Cleaned:     '{target_no_punct}'", file=sys.stderr)
        print("\nAll detected text boxes:", file=sys.stderr)

        # Build list of all detected text boxes
        all_boxes = []
        for i, (bbox, text, prob) in enumerate(result):
            clean_text = text.lower().strip()
            clean_no_punct = re.sub(r"[^\w\s]", "", clean_text).strip()
            top_left = bbox[0]
            bottom_right = bbox[2]
            x, y = int(top_left[0]), int(top_left[1])
            w, h = int(bottom_right[0] - x), int(bottom_right[1] - y)

            all_boxes.append(
                {"text": clean_text, "text_clean": clean_no_punct, "x": x, "y": y, "w": w, "h": h, "prob": prob}
            )
            print(f"  [{i}] '{clean_text}' at (x={x}, y={y}, w={w}, h={h})", file=sys.stderr)

        print(f"\nTotal: {len(all_boxes)} text boxes detected", file=sys.stderr)

        # Strategy 1: Find exact phrase match in combined text
        combined_all = " ".join(b["text_clean"] for b in all_boxes)
        print(f"\nCombined OCR text: '{combined_all}'", file=sys.stderr)

        # Check if target is a substring
        if target_no_punct in combined_all:
            print("✓ Found exact phrase in combined text!", file=sys.stderr)
            found_boxes = self._find_boxes_for_phrase(all_boxes, target_no_punct)
            if found_boxes:
                merged = self._merge_lines(found_boxes)
                print(f"→ Result: {len(merged)} highlight region(s)", file=sys.stderr)
                return merged

        # Strategy 2: Sliding window search with high similarity threshold
        print("\nTrying sliding window search (80%+ match required)...", file=sys.stderr)
        found_boxes = self._sliding_window_search(all_boxes, target_no_punct, threshold=0.80)
        if found_boxes:
            merged = self._merge_lines(found_boxes)
            print(f"→ Sliding window found {len(merged)} region(s)", file=sys.stderr)
            return merged

        # Strategy 3: Find boxes containing the key unique words
        print("\nTrying key word matching...", file=sys.stderr)
        found_boxes = self._find_key_word_boxes(all_boxes, target_no_punct)
        if found_boxes:
            merged = self._merge_lines(found_boxes)
            print(f"→ Key word match found {len(merged)} region(s)", file=sys.stderr)
            return merged

        print("✗ No matching text found!", file=sys.stderr)
        print("=== END DEBUG ===\n", file=sys.stderr)
        return []

    def _find_boxes_for_phrase(self, all_boxes: list, target: str) -> list:
        """Find boxes that together contain the target phrase."""
        target_words = target.split()
        if not target_words:
            return []

        # Find the first word
        best_match = None
        for start_idx, box in enumerate(all_boxes):
            # Check if this box contains the start of our phrase
            box_text = box["text_clean"]
            if target_words[0] in box_text.split():
                # Try to match remaining words in following boxes
                matched_boxes = [box]
                word_idx = 1

                for next_idx in range(start_idx + 1, len(all_boxes)):
                    if word_idx >= len(target_words):
                        break
                    next_box = all_boxes[next_idx]
                    next_words = next_box["text_clean"].split()

                    for nw in next_words:
                        if word_idx < len(target_words) and nw == target_words[word_idx]:
                            matched_boxes.append(next_box)
                            word_idx += 1
                            break

                # Calculate match coverage
                coverage = word_idx / len(target_words)
                if coverage > 0.7:  # At least 70% of words matched
                    if best_match is None or len(matched_boxes) > len(best_match):
                        best_match = matched_boxes

        if best_match:
            return [{"x": b["x"], "y": b["y"], "w": b["w"], "h": b["h"]} for b in best_match]
        return []

    def _sliding_window_search(self, all_boxes: list, target: str, threshold: float = 0.80) -> list:
        """Search using a sliding window over consecutive boxes."""
        target_words = set(target.split())
        best_score = 0
        best_boxes = []

        for start_idx in range(len(all_boxes)):
            for window_size in range(1, min(10, len(all_boxes) - start_idx + 1)):
                subset = all_boxes[start_idx : start_idx + window_size]
                subset_text = " ".join(b["text_clean"] for b in subset)

                # Calculate similarity
                similarity = SequenceMatcher(None, subset_text, target).ratio()

                # Also check word overlap
                subset_words = set(subset_text.split())
                common_words = target_words & subset_words
                word_overlap = len(common_words) / max(len(target_words), 1)

                # Combined score
                combined_score = (similarity + word_overlap) / 2

                if combined_score > best_score and combined_score >= threshold:
                    best_score = combined_score
                    best_boxes = [{"x": b["x"], "y": b["y"], "w": b["w"], "h": b["h"]} for b in subset]
                    print(
                        f"  Window [{start_idx}:{start_idx + window_size}] = '{subset_text[:50]}...' score={combined_score:.2f}",
                        file=sys.stderr,
                    )

        if best_score >= threshold:
            print(f"  → Best match score: {best_score:.2f}", file=sys.stderr)
            return best_boxes
        return []

    def _find_key_word_boxes(self, all_boxes: list, target: str) -> list:
        """Find boxes containing distinctive keywords from target."""
        # Extract unique/distinctive words (longer words, not common)
        common_words = {"the", "a", "an", "to", "in", "for", "of", "and", "is", "it", "be", "on", "at"}
        target_words = [w for w in target.split() if w not in common_words and len(w) > 2]

        if not target_words:
            target_words = target.split()  # Fallback to all words

        print(f"  Key words to find: {target_words}", file=sys.stderr)

        found_boxes = []
        matched_words = set()

        for box in all_boxes:
            box_words = set(box["text_clean"].split())
            for tw in target_words:
                if tw in box_words and tw not in matched_words:
                    found_boxes.append({"x": box["x"], "y": box["y"], "w": box["w"], "h": box["h"]})
                    matched_words.add(tw)
                    print(f"  Found '{tw}' in box at y={box['y']}", file=sys.stderr)
                    break

        # Require at least 50% of key words to be found
        if len(matched_words) >= len(target_words) * 0.5:
            return found_boxes
        return []

    def _merge_lines(self, boxes: list) -> list:
        """Merge individual word boxes into line-by-line blocks."""
        if not boxes:
            return []

        # Sort boxes by y position first, then by x
        sorted_boxes = sorted(boxes, key=lambda b: (b["y"], b["x"]))

        lines = []
        current_line = sorted_boxes[0].copy()

        for i in range(1, len(sorted_boxes)):
            box = sorted_boxes[i]
            # If box is roughly on the same Y level (within 30px margin)
            if abs(box["y"] - current_line["y"]) < 30:
                # Extend current line width to include this box
                right_edge = max(current_line["x"] + current_line["w"], box["x"] + box["w"])
                left_edge = min(current_line["x"], box["x"])
                current_line["x"] = left_edge
                current_line["w"] = right_edge - left_edge
                current_line["h"] = max(current_line["h"], box["h"])
            else:
                lines.append(current_line)
                current_line = box.copy()

        lines.append(current_line)
        return lines

    def _draw_rounded_rect(
        self, img: np.ndarray, x: int, y: int, w: int, h: int, color: tuple, radius: int = 8, opacity: float = 0.5
    ) -> np.ndarray:
        """Draw a rounded rectangle on the image with blending."""
        overlay = img.copy()

        # Ensure coordinates are valid
        x, y = max(0, x), max(0, y)
        x2, y2 = min(x + w, img.shape[1]), min(y + h, img.shape[0])

        if x2 <= x or y2 <= y:
            return img

        # For simplicity, use rectangle with cv2 (rounded corners require more complex drawing)
        # Create a mask for rounded rectangle
        h_actual = y2 - y
        w_actual = x2 - x
        radius = min(radius, h_actual // 2, w_actual // 2)

        # Draw filled rectangle
        cv2.rectangle(overlay, (x + radius, y), (x2 - radius, y2), color, -1)
        cv2.rectangle(overlay, (x, y + radius), (x2, y2 - radius), color, -1)

        # Draw corner circles
        cv2.circle(overlay, (x + radius, y + radius), radius, color, -1)
        cv2.circle(overlay, (x2 - radius, y + radius), radius, color, -1)
        cv2.circle(overlay, (x + radius, y2 - radius), radius, color, -1)
        cv2.circle(overlay, (x2 - radius, y2 - radius), radius, color, -1)

        # Blend using screen blend mode
        img_float = img.astype(np.float32) / 255.0
        overlay_float = overlay.astype(np.float32) / 255.0

        # Screen blend: 1 - (1-a)(1-b)
        blended = 1 - (1 - img_float) * (1 - overlay_float * opacity)

        return (np.clip(blended, 0, 1) * 255).astype(np.uint8)

    def create_highlight_video(
        self,
        image_path: str,
        boxes: list,
        output_path: str = "output.mp4",
        color: tuple = (255, 255, 0),
        duration_per_line: float = 0.4,
        total_duration: float = 3.0,
        padding: int = 6,
    ) -> str:
        """Create an animated highlight video with left-to-right reveal."""
        print(f"Creating highlight video: {output_path}", file=sys.stderr)

        # Load the background image
        background_img = cv2.imread(image_path)
        if background_img is None:
            raise ValueError(f"Could not load image: {image_path}")
        background_img = cv2.cvtColor(background_img, cv2.COLOR_BGR2RGB)
        img_h, img_w = background_img.shape[:2]

        # Prepare highlight boxes with timing
        highlight_data = []
        start_time = 0.5

        for i, box in enumerate(boxes):
            x = max(0, box["x"] - padding)
            y = max(0, box["y"] - padding)
            w = min(box["w"] + (padding * 2), img_w - x)
            h = min(box["h"] + (padding * 2), img_h - y)

            print(f"  Box {i + 1}: x={x}, y={y}, w={w}, h={h}, starts={start_time:.2f}s", file=sys.stderr)

            highlight_data.append(
                {"x": x, "y": y, "w": w, "h": h, "start": start_time, "end": start_time + duration_per_line}
            )
            start_time += duration_per_line

        # Calculate FPS and total frames
        fps = 24
        total_frames = int(total_duration * fps)

        # Create output video using OpenCV (more reliable than MoviePy for this)
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(output_path, fourcc, fps, (img_w, img_h))

        print(f"Generating {total_frames} frames...", file=sys.stderr)

        for frame_idx in range(total_frames):
            t = frame_idx / fps
            frame = background_img.copy()

            for hl in highlight_data:
                x, y, w, h = hl["x"], hl["y"], hl["w"], hl["h"]
                hl_start, hl_end = hl["start"], hl["end"]

                # Calculate animation progress
                if t < hl_start:
                    progress = 0.0
                elif t >= hl_end:
                    progress = 1.0
                else:
                    linear = (t - hl_start) / (hl_end - hl_start)
                    progress = 1 - (1 - linear) ** 3  # ease-out-cubic

                if progress > 0:
                    current_w = max(1, int(w * progress))
                    frame = self._draw_rounded_rect(
                        frame, x, y, current_w, h, color, radius=min(8, h // 3), opacity=0.55
                    )

            # Convert RGB to BGR for OpenCV
            frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
            out.write(frame_bgr)

        out.release()

        # Convert to proper H.264 format using ffmpeg if available
        temp_path = output_path + ".temp.mp4"
        os.rename(output_path, temp_path)

        import subprocess

        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    temp_path,
                    "-c:v",
                    "libx264",
                    "-preset",
                    "fast",
                    "-pix_fmt",
                    "yuv420p",
                    output_path,
                ],
                check=True,
                capture_output=True,
            )
            os.remove(temp_path)
        except (subprocess.CalledProcessError, FileNotFoundError):
            # ffmpeg not available, use the original
            os.rename(temp_path, output_path)

        print(f"Video created successfully: {output_path}", file=sys.stderr)
        return output_path


def parse_color(color_str: str) -> tuple:
    """Parse color string to RGB tuple."""
    color_map = {
        "yellow": (255, 255, 0),
        "blue": (100, 149, 237),
        "green": (0, 255, 127),
        "pink": (255, 105, 180),
        "orange": (255, 165, 0),
        "white": (255, 255, 255),
    }

    color_str = color_str.lower().strip()

    if color_str in color_map:
        return color_map[color_str]

    if color_str.startswith("#"):
        hex_color = color_str[1:]
        if len(hex_color) == 6:
            return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))

    return (255, 255, 0)


def main():
    parser = argparse.ArgumentParser(description="Create animated text highlight videos from screenshots")
    parser.add_argument("--image_path", required=True, help="Path to input image")
    parser.add_argument("--target_text", required=True, help="Text to highlight")
    parser.add_argument("--output", default="output.mp4", help="Output video path")
    parser.add_argument("--color", default="yellow", help="Highlight color")
    parser.add_argument("--duration", type=float, default=0.4, help="Duration per line")
    parser.add_argument("--json_output", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    try:
        highlighter = TextHighlighter()
        boxes = highlighter.find_text_coordinates(args.image_path, args.target_text)

        if not boxes:
            result = {"success": False, "error": "Text not found in image", "boxes": []}
            if args.json_output:
                print(json.dumps(result))
            else:
                print("Error: Text not found in image", file=sys.stderr)
            sys.exit(1)

        color = parse_color(args.color)
        output_path = highlighter.create_highlight_video(
            args.image_path, boxes, args.output, color=color, duration_per_line=args.duration
        )

        result = {"success": True, "output": output_path, "boxes": boxes}

        if args.json_output:
            print(json.dumps(result))
        else:
            print(f"Success! Video saved to: {output_path}")

    except Exception as e:
        import traceback

        traceback.print_exc(file=sys.stderr)
        result = {"success": False, "error": str(e)}
        if args.json_output:
            print(json.dumps(result))
        else:
            print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
