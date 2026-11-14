#!/usr/bin/env python3
"""
Content Creator - AI-powered SSML script generator for Speechify TTS.
Generates human-like, emotionally expressive audio for short-form content creation.
"""

import argparse
import json
import sys
import os
import urllib.request
import urllib.error


def call_openrouter(prompt: str, api_key: str) -> str:
    """Call OpenRouter API with the given prompt."""
    url = "https://openrouter.ai/api/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "Easy Edits Content Creator"
    }
    
    data = {
        "model": "mistralai/mistral-7b-instruct:free",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 3000,
        "temperature": 0.85
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers=headers,
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result['choices'][0]['message']['content']
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f"OpenRouter API error: {e.code} - {error_body}")


def generate_script(topic: str, comment: str = None, api_key: str = None) -> dict:
    """
    Generate a human-like, emotionally expressive SSML script for Speechify TTS.
    Optimized for viral short-form content (Reels, Shorts, TikTok).
    """
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not provided")
    
    iteration_context = ""
    if comment:
        iteration_context = f"""
USER FEEDBACK ON PREVIOUS VERSION:
"{comment}"
Please improve the script based on this feedback while keeping it human-like.
"""

    prompt = f'''You are a professional voice-over script writer creating content for TEXT-TO-SPEECH (Speechify AI).

Your goal: Create a NATURAL, HUMAN-LIKE script that sounds like a real content creator speaking on camera.

## SPEECHIFY SSML CAPABILITIES (USE THESE TO MAKE IT SOUND HUMAN):

### 1. EMOTIONS - <speechify:style emotion="X">...</speechify:style>
Use these to match the feeling of what's being said:
- "energetic" - For hooks, exciting reveals (makes voice dynamic and lively)
- "assertive" - For bold claims, confident statements 
- "cheerful" - For positive content, CTA, upbeat moments
- "warm" - For connecting with audience, personal stories
- "surprised" - For shocking facts, plot twists
- "bright" - For optimistic, inspirational content
- "direct" - For facts, straightforward information

### 2. SPEED - <prosody rate="X">...</prosody>
- "fast" or "+20%" - For exciting parts, list items, building energy
- "medium" - Normal conversational pace
- "slow" or "-10%" - For emphasis, letting key points land

### 3. PAUSES - <break time="Xms"/>
CRITICAL for natural speech! Real people pause. Use:
- <break time="200ms"/> - Brief breath between phrases
- <break time="400ms"/> - Between ideas/sentences
- <break time="600ms"/> - Dramatic pause before reveals
- <break time="800ms"/> - Major section transitions

### 4. EMPHASIS - <emphasis level="X">...</emphasis>
- "strong" - Really important words (use sparingly!)
- "moderate" - Somewhat important words

### 5. PUNCTUATION MATTERS:
- Use "!" for excitement - makes voice more energetic
- Use "..." for suspense, hesitation
- Use "?" for genuine curiosity
- Short sentences sound more natural than long ones

## CRITICAL BEST PRACTICES FOR HUMAN-LIKE SPEECH:

1. **SHORT SENTENCES** - Break long thoughts into 5-10 word chunks
2. **MATCH EMOTION TO TEXT** - Don't use "cheerful" for scary content
3. **VARY THE PACING** - Alternate fast and slower sections
4. **USE PAUSES LIBERALLY** - Real people breathe and think
5. **NATURAL WORD FLOW** - Write how people actually talk, not formal writing
6. **EMOTIONAL JOURNEY** - Hook is energetic, main points vary, CTA is warm

TOPIC: "{topic}"
{iteration_context}

## OUTPUT STRUCTURE FOR VIRAL SHORT-FORM CONTENT:

Create a script with this flow:
1. HOOK (0-3 sec): Pattern-interrupt opener. Use emotion="energetic" or "surprised"
2. CONTEXT (3-8 sec): Quick setup. Use emotion="direct" or "assertive"  
3. MAIN POINTS (8-45 sec): 2-3 key insights with varied emotions and pacing
4. CTA (45-60 sec): Call to action. Use emotion="warm" or "cheerful"

## RESPONSE FORMAT:
Return a JSON object with exactly these fields:
{{
    "ssml_script": "<speak>YOUR FULL SSML SCRIPT HERE</speak>",
    "plain_text": "Plain text version without any SSML tags",
    "estimated_duration": "X-Y seconds",
    "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}}

## EXAMPLE OF GREAT SSML (study this structure):
<speak>
<speechify:style emotion="energetic">Stop scrolling!</speechify:style>
<break time="300ms"/>
<speechify:style emotion="surprised">This might blow your mind.</speechify:style>
<break time="400ms"/>
<prosody rate="medium">
<speechify:style emotion="direct">So here's the thing...</speechify:style>
<break time="200ms"/>
Most people don't realize this, but
<emphasis level="strong">your phone</emphasis>
<break time="200ms"/>
is listening to you right now.
</prosody>
<break time="500ms"/>
<prosody rate="fast">
<speechify:style emotion="assertive">
Here's proof!
</speechify:style>
</prosody>
<break time="600ms"/>
<speechify:style emotion="warm">
Follow for more tech secrets. Trust me, you'll want to see what's next.
</speechify:style>
</speak>

IMPORTANT RULES:
- Return ONLY the JSON object, nothing else
- The ssml_script MUST start with <speak> and end with </speak>
- Make it sound HUMAN, not robotic
- Use breaks between almost every sentence
- Vary emotions throughout the script
- Keep it under 60 seconds total
'''

    try:
        response_text = call_openrouter(prompt, api_key)
        
        # Try to extract JSON from response
        text = response_text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        # Try to find JSON object in the text
        start_idx = text.find('{')
        end_idx = text.rfind('}')
        if start_idx != -1 and end_idx != -1:
            text = text[start_idx:end_idx+1]
        
        script_data = json.loads(text)
        
        return {
            "success": True,
            "script": script_data
        }
        
    except json.JSONDecodeError as e:
        # If JSON parse fails, try to return raw text
        return {
            "success": True,
            "script": {
                "plain_text": response_text if 'response_text' in dir() else "No response",
                "parse_error": str(e)
            },
            "warning": "Could not parse as structured JSON, returning raw text"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def find_resources(topic: str, comment: str = None, api_key: str = None) -> dict:
    """
    Generate resource suggestions for the topic.
    """
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not provided")
    
    iteration_context = ""
    if comment:
        iteration_context = f"""
The user wants different resources. Their feedback:
"{comment}"

Please provide better suggestions based on this feedback.
"""

    prompt = f"""You are a research assistant helping find video resources for creating tech content.

Topic: "{topic}"
{iteration_context}

Suggest resources that would be valuable for creating a viral video about this topic:

1. **YouTube Videos** (2-3): Suggest specific channels or video types
2. **News Articles** (2-3): Major tech news sites with likely coverage
3. **Social Posts** (2-3): X/Twitter accounts or posts

Format as JSON:
{{
    "youtube_videos": [
        {{"url": "https://youtube.com/...", "title": "...", "why_useful": "...", "suggested_clip": "..."}}
    ],
    "articles": [
        {{"url": "https://...", "title": "...", "key_points": "..."}}
    ],
    "social_posts": [
        {{"platform": "X/Twitter", "url": "https://x.com/...", "summary": "...", "why_useful": "..."}}
    ],
    "search_summary": "Brief summary of search strategy"
}}

Return ONLY the JSON object.
"""

    try:
        response_text = call_openrouter(prompt, api_key)
        
        text = response_text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        start_idx = text.find('{')
        end_idx = text.rfind('}')
        if start_idx != -1 and end_idx != -1:
            text = text[start_idx:end_idx+1]
        
        resources_data = json.loads(text)
        
        return {
            "success": True,
            "resources": resources_data
        }
        
    except json.JSONDecodeError as e:
        return {
            "success": True,
            "resources": {
                "raw_text": response_text if 'response_text' in dir() else "No response",
                "parse_error": str(e)
            },
            "warning": "Could not parse as structured JSON"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def main():
    parser = argparse.ArgumentParser(
        description='AI Content Creator - Human-like SSML for Speechify TTS'
    )
    parser.add_argument('--action', required=True, choices=['script', 'resources'],
                        help='Action to perform: script or resources')
    parser.add_argument('--topic', required=True, help='Topic for content creation')
    parser.add_argument('--comment', default=None, help='Feedback for iteration')
    parser.add_argument(
        '--api_key',
        default=os.environ.get('OPENROUTER_API_KEY'),
        help='OpenRouter API key (defaults to the OPENROUTER_API_KEY environment variable)',
    )

    args = parser.parse_args()
    
    try:
        if args.action == 'script':
            result = generate_script(args.topic, args.comment, args.api_key)
        elif args.action == 'resources':
            result = find_resources(args.topic, args.comment, args.api_key)
        else:
            result = {"success": False, "error": f"Unknown action: {args.action}"}
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
