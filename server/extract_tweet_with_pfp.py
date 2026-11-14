#!/usr/bin/env python3
"""
Tweet Downloader with Profile Picture
Downloads tweet content, metadata, and profile picture using gallery-dl.

Usage in Colab:
    !pip install gallery-dl requests
    !python extract_tweet_with_pfp.py <tweet_url>
"""

import glob
import json
import os
import subprocess
import sys

import requests


def download_tweet_with_pfp(tweet_url: str, output_dir: str = "./tweet_data") -> dict:
    """
    Download tweet metadata, images, and profile picture.

    Args:
        tweet_url: URL of the tweet (twitter.com or x.com)
        output_dir: Directory to save downloaded files

    Returns:
        Dict with extracted tweet info and file paths
    """
    os.makedirs(output_dir, exist_ok=True)

    print(f"📥 Downloading tweet: {tweet_url}")

    # Step 1: Download tweet with gallery-dl (includes metadata)
    result = subprocess.run(
        ["gallery-dl", "--write-metadata", "-D", output_dir, tweet_url], capture_output=True, text=True
    )

    if result.returncode != 0:
        print(f"❌ gallery-dl error: {result.stderr}")
        return None

    print("✓ Downloaded tweet content")

    # Step 2: Find the metadata JSON file
    json_files = glob.glob(os.path.join(output_dir, "**/*.json"), recursive=True)

    if not json_files:
        print("❌ No metadata JSON found")
        return None

    # Parse the metadata
    metadata = None
    for json_file in json_files:
        with open(json_file) as f:
            try:
                metadata = json.load(f)
                break
            except json.JSONDecodeError:
                continue

    if not metadata:
        print("❌ Could not parse metadata")
        return None

    # Step 3: Extract tweet info
    tweet_info = extract_tweet_info(metadata)

    # Step 4: Download profile picture
    if tweet_info.get("profile_image_url"):
        pfp_path = download_profile_picture(tweet_info["profile_image_url"], tweet_info["username"], output_dir)
        tweet_info["profile_image_local"] = pfp_path

    # Step 5: Find downloaded media files
    media_files = []
    for ext in ["*.jpg", "*.jpeg", "*.png", "*.mp4", "*.gif"]:
        for f in glob.glob(os.path.join(output_dir, "**/" + ext), recursive=True):
            if "profile_" not in f:  # Exclude profile pics from media list
                media_files.append(f)
    tweet_info["media_files"] = media_files

    # Save extracted info as JSON
    info_path = os.path.join(output_dir, "tweet_info.json")
    with open(info_path, "w") as f:
        json.dump(tweet_info, f, indent=2)

    print(f"\n✅ Tweet data saved to: {output_dir}")
    print(f"   Username: @{tweet_info.get('username', 'unknown')}")
    print(f"   Display Name: {tweet_info.get('display_name', 'unknown')}")
    print(f"   Tweet Text: {tweet_info.get('text', '')[:100]}...")
    print(f"   Profile Picture: {tweet_info.get('profile_image_local', 'N/A')}")
    print(f"   Media Files: {len(media_files)}")

    return tweet_info


def extract_tweet_info(metadata: dict) -> dict:
    """Extract relevant tweet info from gallery-dl metadata."""

    # gallery-dl metadata structure varies, handle different formats
    info = {
        "username": None,
        "display_name": None,
        "text": None,
        "profile_image_url": None,
        "created_at": None,
        "retweet_count": None,
        "like_count": None,
        "tweet_id": None,
    }

    # Try common metadata paths
    if isinstance(metadata, dict):
        # Direct fields
        info["username"] = (
            metadata.get("author", {}).get("nick")
            or metadata.get("user", {}).get("screen_name")
            or metadata.get("username")
        )
        info["display_name"] = (
            metadata.get("author", {}).get("name")
            or metadata.get("user", {}).get("name")
            or metadata.get("author_name")
        )
        info["text"] = metadata.get("content") or metadata.get("full_text") or metadata.get("text")
        info["tweet_id"] = metadata.get("tweet_id") or metadata.get("id_str") or metadata.get("id")
        info["created_at"] = metadata.get("date") or metadata.get("created_at")
        info["retweet_count"] = metadata.get("retweet_count")
        info["like_count"] = metadata.get("favorite_count") or metadata.get("like_count")

        # Profile image URL - try multiple paths
        profile_url = (
            metadata.get("author", {}).get("profile_image")
            or metadata.get("user", {}).get("profile_image_url_https")
            or metadata.get("user", {}).get("profile_image_url")
            or metadata.get("profile_image_url")
        )

        if profile_url:
            # Get higher resolution version (remove _normal suffix)
            info["profile_image_url"] = profile_url.replace("_normal", "_400x400")

    return info


def download_profile_picture(url: str, username: str, output_dir: str) -> str:
    """Download the profile picture to local file."""

    if not url:
        return None

    try:
        # Determine file extension from URL
        ext = "jpg"
        if ".png" in url:
            ext = "png"
        elif ".gif" in url:
            ext = "gif"

        filename = f"profile_{username}.{ext}"
        filepath = os.path.join(output_dir, filename)

        print(f"📷 Downloading profile picture: {url}")

        response = requests.get(url, timeout=30)
        response.raise_for_status()

        with open(filepath, "wb") as f:
            f.write(response.content)

        print(f"✓ Saved profile picture: {filepath}")
        return filepath

    except Exception as e:
        print(f"⚠️ Could not download profile picture: {e}")
        return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_tweet_with_pfp.py <tweet_url> [output_dir]")
        print("Example: python extract_tweet_with_pfp.py https://x.com/user/status/123456789")
        sys.exit(1)

    tweet_url = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./tweet_data"

    result = download_tweet_with_pfp(tweet_url, output_dir)

    if result:
        print("\n📋 Full tweet info:")
        print(json.dumps(result, indent=2))
        sys.exit(0)
    else:
        print("❌ Failed to download tweet")
        sys.exit(1)


if __name__ == "__main__":
    main()
