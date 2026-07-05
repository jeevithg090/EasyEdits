# Caption Generation Fix for Easy-Edits Colab Worker
# This file contains the updated generate_ass_subtitles function that properly
# handles caption position and color settings from user input.
#
# INSTRUCTIONS:
# Copy the generate_ass_subtitles function below and replace the existing one 
# in Cell 6 of EasyEdits_AutoCrop_Worker.ipynb

import re

# Theme configurations (same as before)
FONT_THEMES = {
    'montserrat': 'Montserrat',
    'poppins': 'Poppins',
    'roboto': 'Roboto',
    'opensans': 'Open Sans',
    'inter': 'Inter',
    'bebas': 'Bebas Neue',
    'oswald': 'Oswald',
    'anton': 'Anton'
}

COLOR_THEMES = {
    'white': '&HFFFFFF',
    'black': '&H000000',
    'yellow': '&H00FFFF',
    'red': '&H0000FF',
    'cyan': '&HFFFF00',
    'lime': '&H00FF00',
    'pink': '&HFF00FF',
    'orange': '&H0080FF'
}

HIGHLIGHT_THEMES = {
    'yellow': '&H00FFFF',
    'cyan': '&HFFFF00',
    'lime': '&H00FF00',
    'magenta': '&HFF00FF',
    'orange': '&H0080FF',
    'red': '&H0000FF',
    'white': '&HFFFFFF',
    'gold': '&H00D7FF'
}

def format_ass_time(seconds):
    """Convert seconds to ASS time format (H:MM:SS.cc)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours}:{minutes:02d}:{secs:05.2f}"

def generate_ass_subtitles(transcription, output_path, settings):
    """
    Generate ASS subtitle file with karaoke-style word highlighting.
    
    settings:
        font: font key from FONT_THEMES
        color: color key from COLOR_THEMES
        highlightColor: color key from HIGHLIGHT_THEMES
        wordsPerSegment: number of words per caption line (default 4)
        position: 'top', 'center', 'bottom', or 'custom'
        customPositionY: percentage from top (0-100) for custom position
    """
    words = transcription.get('words', [])
    if not words:
        print("⚠️ No words to generate captions")
        return None
    
    font = FONT_THEMES.get(settings.get('font', 'montserrat'), 'Montserrat')
    color = COLOR_THEMES.get(settings.get('color', 'white'), '&HFFFFFF')
    highlight = HIGHLIGHT_THEMES.get(settings.get('highlightColor', 'yellow'), '&H00FFFF')
    words_per_segment = settings.get('wordsPerSegment', 4)
    position = settings.get('position', 'bottom')
    custom_position_y = settings.get('customPositionY', 85)
    
    # Calculate alignment and MarginV based on position (for 1920 height video)
    # Alignment values in ASS:
    #   1=bottom-left, 2=bottom-center, 3=bottom-right
    #   4=middle-left, 5=middle-center, 6=middle-right  
    #   7=top-left, 8=top-center, 9=top-right
    # MarginV is distance from the relevant edge based on alignment
    position_config = {
        'top': {'alignment': 8, 'margin_v': 100},      # Top center, 100px from top
        'center': {'alignment': 5, 'margin_v': 0},     # Middle center
        'bottom': {'alignment': 2, 'margin_v': 100},   # Bottom center, 100px from bottom
        'custom': {'alignment': 5, 'margin_v': int((custom_position_y / 100) * 1920 - 960)}
    }
    pos_cfg = position_config.get(position, position_config['bottom'])
    alignment = pos_cfg['alignment']
    margin_v = pos_cfg['margin_v']
    
    print(f"📝 Caption settings: font={font}, color={settings.get('color')} → {color}, highlight={settings.get('highlightColor')} → {highlight}, position={position}, alignment={alignment}, marginV={margin_v}")
    
    # ASS header with correct position settings
    # Note: In ASS karaoke, SecondaryColour is used for the highlight effect
    # PrimaryColour = normal text color
    # SecondaryColour = karaoke highlight color (used by \k and \kf tags)
    ass_content = f"""[Script Info]
Title: Easy-Edits Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font},80,{color},{highlight},&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,2,{alignment},40,40,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    # Group words into segments
    segments = []
    for i in range(0, len(words), words_per_segment):
        segment_words = words[i:i + words_per_segment]
        if segment_words:
            segments.append({
                'words': segment_words,
                'start': segment_words[0]['start'],
                'end': segment_words[-1]['end']
            })
    
    # Generate karaoke lines
    for segment in segments:
        start_time = format_ass_time(segment['start'])
        end_time = format_ass_time(segment['end'])
        
        # Build karaoke text with word-by-word highlighting
        karaoke_text = ""
        segment_start = segment['start']
        
        for word_data in segment['words']:
            word = word_data['word']
            word_start = word_data['start']
            word_end = word_data['end']
            word_duration = int((word_end - word_start) * 100)  # centiseconds
            pre_delay = int((word_start - segment_start) * 100)  # time before this word
            
            # Use \k for karaoke timing (highlights word when spoken)
            if pre_delay > 0:
                karaoke_text += f"{{\\k{pre_delay}}}"
            karaoke_text += f"{{\\kf{word_duration}}}{word} "
            segment_start = word_end
        
        ass_content += f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{karaoke_text.strip()}\n"
    
    # Write ASS file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(ass_content)
    
    print(f"✅ Generated ASS subtitles: {output_path}")
    return output_path


def burn_captions(input_video, output_video, ass_file):
    """
    Burn ASS subtitles into video using FFmpeg.
    """
    import subprocess
    print(f"🔥 Burning captions into video...")
    
    cmd = [
        'ffmpeg', '-y',
        '-i', input_video,
        '-vf', f"ass='{ass_file}'",
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-crf', '18',
        '-c:a', 'copy',
        output_video
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"❌ FFmpeg error: {result.stderr}")
        raise Exception(f"Caption burn failed: {result.stderr}")
    
    print(f"✅ Captioned video: {output_video}")
    return output_video


# For testing
if __name__ == "__main__":
    test_transcription = {
        'words': [
            {'word': 'Hello', 'start': 0.0, 'end': 0.5},
            {'word': 'world', 'start': 0.5, 'end': 1.0},
            {'word': 'this', 'start': 1.2, 'end': 1.5},
            {'word': 'is', 'start': 1.5, 'end': 1.7},
        ],
        'text': 'Hello world this is',
        'language': 'en'
    }
    
    # Test top position
    generate_ass_subtitles(test_transcription, '/tmp/test_top.ass', {
        'font': 'montserrat',
        'color': 'yellow',
        'highlightColor': 'cyan',
        'position': 'top'
    })
    
    # Test center position
    generate_ass_subtitles(test_transcription, '/tmp/test_center.ass', {
        'font': 'bebas',
        'color': 'red',
        'highlightColor': 'white',
        'position': 'center'
    })
    
    print("✅ Tests completed!")
