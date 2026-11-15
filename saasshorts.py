"""
SaaSShorts (100% Free Edition): AI-powered UGC & Faceless Video Generator.

Generates viral TikTok/Instagram Reels/YouTube Shorts content from any URL or topic
with ZERO paid third-party media APIs required:
  1. Scrape & analyze website or topic (Clarity AI Hub: Gemini, Ollama, Groq, DeepSeek, etc.)
  2. Generate 5-segment viral scripts (Hook -> Problem -> Solution -> Demo -> CTA)
  3. Generate AI presenter portraits & cinematic B-roll (Free Flux via Pollinations + Pillow HD fallback)
  4. Generate natural neural voiceover (Free Microsoft Edge Neural TTS via `edge-tts`)
  5. Animate presenter talking head & Ken Burns B-roll clips (FFmpeg)
  6. Composite final vertical 9:16 video with TikTok ASS subtitles (FFmpeg)
"""

import asyncio
import json
import os
import random
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, Dict, List, Optional
from urllib.parse import quote, urljoin

import httpx
from PIL import Image, ImageDraw, ImageFont

from ai_hub import call_ai, current_settings, is_ready
from ffmpeg_utils import DELIVERY, mark_ai_generated, video_encode_args

# Free Neural Voices (no API key required)
FREE_VOICES = [
    {"voice_id": "en-US-AvaMultilingualNeural", "name": "Ava (Female, Warm & Natural)", "category": "free-neural", "labels": {"gender": "female", "language": "en"}},
    {"voice_id": "en-US-AndrewMultilingualNeural", "name": "Andrew (Male, Confident & Clear)", "category": "free-neural", "labels": {"gender": "male", "language": "en"}},
    {"voice_id": "en-US-EmmaMultilingualNeural", "name": "Emma (Female, Upbeat Creator)", "category": "free-neural", "labels": {"gender": "female", "language": "en"}},
    {"voice_id": "en-US-BrianMultilingualNeural", "name": "Brian (Male, Storytelling)", "category": "free-neural", "labels": {"gender": "male", "language": "en"}},
    {"voice_id": "en-GB-SoniaNeural", "name": "Sonia (Female, British)", "category": "free-neural", "labels": {"gender": "female", "language": "en"}},
    {"voice_id": "en-GB-RyanNeural", "name": "Ryan (Male, British)", "category": "free-neural", "labels": {"gender": "male", "language": "en"}},
    {"voice_id": "es-ES-ElviraNeural", "name": "Elvira (Female, Spanish)", "category": "free-neural", "labels": {"gender": "female", "language": "es"}},
    {"voice_id": "es-ES-AlvaroNeural", "name": "Alvaro (Male, Spanish)", "category": "free-neural", "labels": {"gender": "male", "language": "es"}},
    {"voice_id": "es-MX-DaliaNeural", "name": "Dalia (Female, LatAm Spanish)", "category": "free-neural", "labels": {"gender": "female", "language": "es"}},
    {"voice_id": "es-MX-JorgeNeural", "name": "Jorge (Male, LatAm Spanish)", "category": "free-neural", "labels": {"gender": "male", "language": "es"}},
]

DEFAULT_VOICES = {v["name"]: v["voice_id"] for v in FREE_VOICES}

# Map legacy ElevenLabs voice IDs to free Edge Neural voices automatically
LEGACY_VOICE_MAP = {
    "21m00Tcm4TlvDq8ikWAM": "en-US-AvaMultilingualNeural",
    "29vD33N1CtxCmqQRPOHJ": "en-US-AndrewMultilingualNeural",
    "EXAVITQu4vr4xnSDxMaL": "es-ES-ElviraNeural",
    "ErXwobaYiN019PkySvjV": "es-ES-AlvaroNeural",
    "TxGEqnHWrfWFTfGW9XjX": "en-US-BrianMultilingualNeural",
    "yoZ06aMxZJJ28mfd3POQ": "en-GB-RyanNeural",
}


def get_elevenlabs_voices(elevenlabs_key: str = "") -> list:
    """Return built-in 100% free neural voices (plus ElevenLabs voices if user optionally passed a key)."""
    voices = list(FREE_VOICES)
    if elevenlabs_key:
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": elevenlabs_key})
                if resp.status_code == 200:
                    for v in resp.json().get("voices", []):
                        voices.append({
                            "voice_id": v["voice_id"],
                            "name": f"{v['name']} (ElevenLabs)",
                            "category": v.get("category", "elevenlabs"),
                            "labels": v.get("labels", {}),
                            "preview_url": v.get("preview_url", ""),
                        })
        except Exception:
            pass
    return voices


# ═══════════════════════════════════════════════════════════════════════
# Phase 1: Website Scraping, Web Research & Analysis
# ═══════════════════════════════════════════════════════════════════════

def research_saas_online(url: str, gemini_key: str = "") -> dict:
    """Research a product online using Gemini search grounding or AI Hub."""
    domain = url.replace("https://", "").replace("http://", "").split("/")[0]
    if gemini_key:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=gemini_key)
            prompt = f"""Research this product thoroughly:
Product URL: {url}
Domain: {domain}
Return a JSON object with: product_name, website_url, what_it_does, target_market, pricing_info, user_sentiment, real_reviews, common_complaints, common_praise, competitors, viral_potential, key_differentiators."""
            response = client.models.generate_content(
                model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
                contents=[prompt],
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                ),
            )
            raw = (response.text or "").strip()
            s, e = raw.find("{"), raw.rfind("}")
            if s != -1 and e != -1:
                data = json.loads(raw[s : e + 1])
                data["grounding_sources"] = []
                return data
        except Exception as e:
            print(f"[SaaSShorts] Web search grounding fallback: {e}")

    return {"product_name": domain, "website_url": url, "grounding_sources": []}


def scrape_website(url: str) -> dict:
    import ssrf_guard
    with ssrf_guard.guarded():
        return _scrape_website(url)


def _scrape_website(url: str) -> dict:
    from bs4 import BeautifulSoup
    from security_utils import assert_public_url

    current = assert_public_url(url)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    }
    with httpx.Client(timeout=25.0, follow_redirects=False) as client:
        response = None
        for _ in range(5):
            response = client.get(current, headers=headers)
            if response.has_redirect_location:
                current = assert_public_url(str(response.next_request.url))
                continue
            break
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "svg", "iframe"]):
        tag.decompose()

    meta_desc = ""
    meta_tag = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
    if meta_tag:
        meta_desc = meta_tag.get("content", "")

    title = soup.title.string.strip() if soup.title and soup.title.string else url
    headings = [h.get_text(strip=True) for h in soup.find_all(["h1", "h2", "h3"]) if h.get_text(strip=True)][:20]
    text = re.sub(r"\n{3,}", "\n\n", soup.get_text(separator="\n", strip=True))[:10000]

    return {
        "url": url,
        "title": title,
        "meta_description": meta_desc,
        "headings": headings,
        "main_content": text,
        "additional_pages": "",
        "pages_scraped": 1,
    }


def analyze_saas(scraped_data: dict, gemini_key: str = "", web_research: dict = None) -> dict:
    """Analyze a product or topic using Clarity's Multi-AI Hub (or offline fallback)."""
    prompt = f"""Analyze this product/topic for creating viral short-form UGC & faceless videos.
Website: {scraped_data.get('url', '')}
Title: {scraped_data.get('title', '')}
Description: {scraped_data.get('meta_description', '')}
Headings: {json.dumps(scraped_data.get('headings', [])[:15])}
Content: {scraped_data.get('main_content', '')[:5000]}

Return a JSON object with:
{{
    "product_name": "Name of product/topic",
    "one_liner": "One-sentence summary",
    "target_audience": ["audience 1", "audience 2"],
    "pain_points": [
        {{"pain": "specific pain point", "intensity": "high", "emotional_trigger": "frustration", "source": "website"}}
    ],
    "key_features": ["feature 1", "feature 2", "feature 3"],
    "unique_selling_points": ["usp 1", "usp 2"],
    "competitors": [{{"name": "Alternative", "comparison": "how they compare"}}],
    "pricing_model": "free / freemium",
    "industry": "technology",
    "emotional_hooks": ["Stop wasting hours on...", "I wish I knew this sooner..."],
    "transformation_story": "Before -> After transformation",
    "viral_angles": [
        {{"angle": "description", "platform": "tiktok", "style": "ugc", "why_viral": "high curiosity"}}
    ]
}}"""
    try:
        analysis = call_ai(prompt, purpose="AI Shorts: product analysis", override_gemini_key=gemini_key)
        if isinstance(analysis, dict) and analysis.get("product_name"):
            return analysis
    except Exception as e:
        print(f"[SaaSShorts] AI analysis fallback: {e}")

    title = scraped_data.get("title") or scraped_data.get("url") or "Clarity Project"
    return {
        "product_name": title[:50],
        "one_liner": scraped_data.get("meta_description") or f"Discover {title} and transform your workflow.",
        "target_audience": ["Creators", "Founders", "Developers"],
        "pain_points": [
            {"pain": "Spending too much time on repetitive manual tasks", "intensity": "high", "emotional_trigger": "time-waste", "source": "general"},
            {"pain": "Expensive subscriptions that lock basic features behind paywalls", "intensity": "high", "emotional_trigger": "frustration", "source": "general"},
        ],
        "key_features": (scraped_data.get("headings") or ["Fast automation", "Clean workflow", "Instant results"])[:4],
        "unique_selling_points": ["Simple to use", "Fast turnaround"],
        "competitors": [],
        "pricing_model": "free",
        "industry": "software",
        "emotional_hooks": [f"Stop doing this the hard way — try {title[:25]}", "I wish I found this tool sooner"],
        "transformation_story": f"From hours of manual work to automated results in minutes with {title[:30]}.",
        "viral_angles": [{"angle": "Before vs After workflow", "platform": "both", "style": "ugc", "why_viral": "Relatable frustration"}],
    }


def generate_scripts(
    analysis: dict,
    gemini_key: str = "",
    num_scripts: int = 3,
    style: str = "ugc",
    language: str = "en",
    actor_gender: str = "female",
) -> list:
    """Generate 5-segment viral scripts using Clarity's AI Hub (or deterministic fallback)."""
    lang_name = "Spanish" if language == "es" else "English"
    prompt = f"""Generate {num_scripts} viral 22-second short-form video scripts in {lang_name} for:
Product: {json.dumps(analysis)}
Style: {style}
Actor gender: {actor_gender}

Return a JSON array where each element has:
- "title": string
- "style": "{style}"
- "duration_seconds": 22
- "target_platform": "tiktok"
- "hook_text": "3-5 word ALL CAPS hook"
- "segments": array of 5 objects:
  1. {{"type": "hook", "start": 0, "end": 5, "narration": "...", "visual": "actor_talking", "broll_prompt": null, "subtitle_text": "..."}}
  2. {{"type": "problem", "start": 5, "end": 9, "narration": "...", "visual": "broll", "broll_prompt": "Detailed visual of the problem...", "subtitle_text": "..."}}
  3. {{"type": "solution", "start": 9, "end": 15, "narration": "...", "visual": "actor_talking", "broll_prompt": null, "subtitle_text": "..."}}
  4. {{"type": "demo", "start": 15, "end": 19, "narration": "...", "visual": "broll", "broll_prompt": "Detailed visual of the solution...", "subtitle_text": "..."}}
  5. {{"type": "cta", "start": 19, "end": 22, "narration": "...", "visual": "actor_talking", "broll_prompt": null, "subtitle_text": "..."}}
- "full_narration": all 5 segment narrations joined with spaces
- "actor_description": "A 27 year old {actor_gender} creator in casual modern attire at a cozy desk setup"
- "hashtags": ["#shorts", "#tech", "#productivity"]
- "caption": "Social media post caption"
"""
    try:
        scripts = call_ai(prompt, purpose="AI Shorts: script generation", override_gemini_key=gemini_key)
        if isinstance(scripts, list) and scripts:
            return scripts
    except Exception as e:
        print(f"[SaaSShorts] Script fallback: {e}")

    pname = analysis.get("product_name", "this tool")
    one_liner = analysis.get("one_liner", "saves hours every week")
    segs = [
        {"type": "hook", "start": 0, "end": 5, "narration": f"Okay, stop scrolling if you still do this manually.", "visual": "actor_talking", "broll_prompt": None, "subtitle_text": "STOP SCROLLING"},
        {"type": "problem", "start": 5, "end": 9, "narration": "We used to waste hours every single week fighting clunky tools.", "visual": "broll", "broll_prompt": "Person looking overwhelmed at multiple laptop screens in a modern office", "subtitle_text": "HOURS WASTED"},
        {"type": "solution", "start": 9, "end": 15, "narration": f"Then I switched to {pname}, and it completely automated the workflow.", "visual": "actor_talking", "broll_prompt": None, "subtitle_text": f"SWITCHED TO {pname.upper()}"},
        {"type": "demo", "start": 15, "end": 19, "narration": f"Look how clean this is: {one_liner}.", "visual": "broll", "broll_prompt": "Sleek glowing dark-mode analytics dashboard on a high-resolution monitor", "subtitle_text": "INSTANT RESULTS"},
        {"type": "cta", "start": 19, "end": 22, "narration": "Check the link in my bio and try it out right now.", "visual": "actor_talking", "broll_prompt": None, "subtitle_text": "LINK IN BIO"},
    ]
    return [
        {
            "title": f"{pname} — Viral Hook #{i + 1}",
            "style": style,
            "duration_seconds": 22,
            "target_platform": "tiktok",
            "hook_text": f"TRY {pname.upper()[:18]}",
            "segments": segs,
            "full_narration": " ".join(s["narration"] for s in segs),
            "actor_description": f"a 27 year old {actor_gender} tech creator sitting at a warm home studio desk with monitor glow",
            "hashtags": ["#shorts", "#productivity", "#aitools"],
            "caption": f"How {pname} changed my workflow! {one_liner}",
        }
        for i in range(max(1, num_scripts))
    ]


# ═══════════════════════════════════════════════════════════════════════
# Phase 2: 100% Free Asset Generation (Pollinations Flux + Pillow + Edge-TTS)
# ═══════════════════════════════════════════════════════════════════════

def _render_styled_card_image(title: str, subtitle: str, output_path: str, theme_idx: int = 0):
    """Render a crisp 1080x1920 vertical visual card using Pillow (offline-safe fallback)."""
    palettes = [
        ((18, 19, 26), (124, 58, 237), (217, 164, 65)),
        ((14, 24, 34), (14, 165, 233), (56, 189, 248)),
        ((24, 16, 28), (236, 72, 153), (244, 114, 182)),
    ]
    bg, accent1, accent2 = palettes[theme_idx % len(palettes)]
    img = Image.new("RGB", (1080, 1920), color=bg)
    draw = ImageDraw.Draw(img)

    # Subtle glowing rings
    for r in range(420, 60, -40):
        draw.ellipse(
            [540 - r, 760 - r, 540 + r, 760 + r],
            outline=accent1 if r % 80 == 0 else accent2,
            width=3,
        )

    # Avatar / Emblem circle
    draw.ellipse([380, 600, 700, 920], fill=accent1, outline=(255, 255, 255), width=6)

    try:
        font_lg = ImageFont.truetype("arial.ttf", 56)
        font_sm = ImageFont.truetype("arial.ttf", 36)
    except Exception:
        font_lg = ImageFont.load_default()
        font_sm = ImageFont.load_default()

    draw.text((540, 1120), (title or "CLARITY AI")[:32].upper(), fill=(255, 255, 255), anchor="mm", font=font_lg)
    draw.text((540, 1210), (subtitle or "")[:55], fill=(200, 205, 220), anchor="mm", font=font_sm)
    img.save(output_path, "PNG")
    return output_path


def _generate_free_flux_image(prompt: str, output_path: str, seed: int = 42, fallback_title: str = "AI Presenter") -> str:
    """Generate a 1080x1920 vertical image for free using Pollinations Flux with Pillow fallback."""
    encoded = quote(prompt[:400])
    url = f"https://image.pollinations.ai/prompt/{encoded}?width=768&height=1344&seed={seed}&nologo=true&model=flux"
    try:
        with httpx.Client(timeout=25.0, follow_redirects=True) as client:
            resp = client.get(url)
            if resp.status_code == 200 and len(resp.content) > 4000:
                with open(output_path, "wb") as f:
                    f.write(resp.content)
                return output_path
    except Exception as e:
        print(f"[SaaSShorts] Pollinations Flux notice (using local HD card): {e}")

    return _render_styled_card_image(fallback_title, prompt[:60], output_path, theme_idx=seed)


def generate_actor_images(
    description: str,
    fal_key: str = "",
    output_dir: str = "outputs",
    title_slug: str = "actor",
    num_options: int = 3,
    product_description: Optional[str] = None,
) -> List[str]:
    """Generate actor portrait options for free (zero paid API keys required)."""
    os.makedirs(output_dir, exist_ok=True)
    clean_desc = (description or "friendly young creator sitting at a studio desk").strip()
    if product_description:
        prompt = f"Candid portrait selfie of {clean_desc}, holding {product_description}, natural soft room lighting, photorealistic"
    else:
        prompt = f"Candid portrait selfie of {clean_desc}, sitting at modern home studio desk with warm monitor glow, photorealistic"

    def _gen_one(i: int) -> str:
        img_path = os.path.join(output_dir, f"{title_slug}_actor_option_{i}.png")
        seed = random.randint(1000, 999999)
        return _generate_free_flux_image(prompt, img_path, seed=seed, fallback_title=f"Creator #{i + 1}")

    paths = []
    with ThreadPoolExecutor(max_workers=max(1, num_options)) as executor:
        futures = [executor.submit(_gen_one, i) for i in range(num_options)]
        for future in as_completed(futures):
            paths.append(future.result())
    return sorted(paths)


def generate_actor_image(description: str, fal_key: str, output_path: str) -> str:
    output_dir = os.path.dirname(output_path) or "outputs"
    title_slug = os.path.basename(output_path).replace("_actor.png", "")
    paths = generate_actor_images(description, fal_key, output_dir, title_slug, num_options=1)
    if paths and paths[0] != output_path:
        import shutil
        shutil.move(paths[0], output_path)
    return output_path


async def _edge_tts_generate(text: str, voice: str, output_path: str):
    import edge_tts
    comm = edge_tts.Communicate(text, voice)
    await comm.save(output_path)


def generate_voiceover(
    text: str,
    elevenlabs_key: str = "",
    output_path: str = "voice.mp3",
    voice_id: str = "en-US-AvaMultilingualNeural",
) -> str:
    """Generate natural neural voiceover for free using Microsoft Edge Neural TTS."""
    resolved_voice = LEGACY_VOICE_MAP.get(voice_id, voice_id or "en-US-AvaMultilingualNeural")
    if "-" not in resolved_voice:
        resolved_voice = "en-US-AvaMultilingualNeural"

    print(f"[SaaSShorts] Generating free neural voiceover ({resolved_voice}, {len(text)} chars)...")
    try:
        asyncio.run(_edge_tts_generate(text, resolved_voice, output_path))
        if os.path.exists(output_path) and os.path.getsize(output_path) > 100:
            return output_path
    except Exception as e:
        print(f"[SaaSShorts] edge-tts fallback warning: {e}")

    # Offline fallback: generate silent audio matching estimated speech duration (~14 chars/sec)
    est_dur = max(5.0, min(25.0, len(text) / 14.0))
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-t", f"{est_dur:.2f}",
            "-c:a", "libmp3lame", "-q:a", "4",
            output_path,
        ],
        check=True,
    )
    return output_path


# ═══════════════════════════════════════════════════════════════════════
# Phase 3: Free Video & B-Roll Synthesis (FFmpeg Motion + Ken Burns)
# ═══════════════════════════════════════════════════════════════════════

def _get_media_duration(path: str) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        output = result.stdout.strip()
        if output:
            return float(output)
    except Exception:
        pass
    return 20.0


def generate_talking_head(
    image_path: str,
    audio_path: str,
    fal_key: str,
    output_path: str,
) -> str:
    """Animate the presenter portrait synchronized to the voiceover audio using FFmpeg."""
    dur = max(3.0, _get_media_duration(audio_path))
    fps = 30
    total_frames = int(dur * fps)
    # Smooth dynamic breathing zoom/pan so the presenter scene feels alive
    vf = (
        f"scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,"
        f"zoompan=z='1.04+0.04*sin(on/25)':"
        f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+8*cos(on/30)':"
        f"d={total_frames}:s=1080x1920:fps={fps},setsar=1"
    )
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-loop", "1", "-i", image_path,
        "-i", audio_path,
        "-vf", vf,
        "-t", f"{dur:.2f}",
        "-map", "0:v:0", "-map", "1:a:0",
        *video_encode_args(DELIVERY),
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k",
        "-shortest",
        output_path,
    ]
    subprocess.run(cmd, check=True)
    return output_path


def generate_talking_head_lowcost(
    image_path: str,
    audio_path: str,
    fal_key: str,
    output_path: str,
) -> str:
    return generate_talking_head(image_path, audio_path, fal_key, output_path)


def generate_broll(
    prompt: str, fal_key: str = "", output_path: str = "broll.mp4", duration: str = "5"
) -> str:
    """Generate B-roll visual + FFmpeg Ken Burns zoom effect 100% free."""
    dur_secs = max(2, int(float(duration)))
    img_path = output_path.replace(".mp4", "_img.png")
    _generate_free_flux_image(
        f"{prompt}. Cinematic vertical photography, shallow depth of field, high contrast.",
        img_path,
        seed=random.randint(1, 999999),
        fallback_title="Scene Highlight",
    )

    fps = 30
    total_frames = dur_secs * fps
    zoompan_filter = (
        f"scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,"
        f"zoompan=z='1+0.15*on/{total_frames}':"
        f"x='iw/2-(iw/zoom/2)+10*on/{total_frames}':"
        f"y='ih/2-(ih/zoom/2)':"
        f"d={total_frames}:s=1080x1920:fps={fps},setsar=1"
    )
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-loop", "1", "-i", img_path,
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-vf", zoompan_filter,
        "-t", str(dur_secs),
        "-map", "0:v", "-map", "1:a",
        *video_encode_args(DELIVERY),
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        output_path,
    ]
    subprocess.run(cmd, check=True)
    if os.path.exists(img_path):
        os.remove(img_path)
    return output_path


# ═══════════════════════════════════════════════════════════════════════
# Phase 4: Subtitles & Compositing
# ═══════════════════════════════════════════════════════════════════════

def _format_ass_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds - int(seconds)) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def transcribe_audio_for_subs(audio_path: str) -> list:
    try:
        from transcribe_backends import release_models, transcribe_media
        try:
            transcript = transcribe_media(audio_path)
        finally:
            release_models()
        return [
            {"word": w["word"].strip(), "start": w["start"], "end": w["end"]}
            for segment in transcript.get("segments", [])
            for w in segment.get("words", [])
        ]
    except Exception:
        return []


def generate_tiktok_subs(audio_path: str, output_path: str, max_words: int = 3, fallback_text: str = "") -> str:
    words = transcribe_audio_for_subs(audio_path)
    if not words and fallback_text:
        dur = _get_media_duration(audio_path)
        tokens = [w for w in fallback_text.split() if w.strip()]
        if tokens:
            step = max(0.15, dur / len(tokens))
            words = [
                {"word": w, "start": i * step, "end": min(dur, (i + 1) * step)}
                for i, w in enumerate(tokens)
            ]

    chunks = []
    for i in range(0, len(words), max_words):
        group = words[i : i + max_words]
        text = " ".join(w["word"] for w in group).upper()
        chunks.append({"text": text, "start": group[0]["start"], "end": group[-1]["end"]})

    ass_content = """[Script Info]
Title: TikTok Style Subs
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TikTok,Arial Black,90,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,0,2,40,40,160,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    for chunk in chunks:
        start = _format_ass_time(chunk["start"])
        end = _format_ass_time(chunk["end"])
        text = re.sub(r"[{}\\]", "", chunk["text"]).replace("\n", "\\N")
        ass_content += f"Dialogue: 0,{start},{end},TikTok,,0,0,0,,{text}\n"

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(ass_content)
    return output_path


def composite_video(
    talking_head_path: str,
    broll_clips: List[Dict],
    srt_path: str,
    hook_text: str,
    output_path: str,
) -> str:
    safe_sub = srt_path.replace("\\", "/").replace(":", "\\:")
    sub_filter = f"ass='{safe_sub}'" if srt_path.endswith(".ass") else f"subtitles='{safe_sub}'"

    if not broll_clips:
        cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-i", talking_head_path,
            "-vf", sub_filter,
            *video_encode_args(DELIVERY),
            "-c:a", "aac", "-b:a", "128k",
            output_path,
        ]
        subprocess.run(cmd, check=True)
        return output_path

    th_duration = _get_media_duration(talking_head_path)
    sorted_broll = sorted(broll_clips, key=lambda x: x["start"])
    broll_durations = {i: _get_media_duration(clip["path"]) for i, clip in enumerate(sorted_broll)}

    segments = []
    prev_end = 0.0
    for i, clip in enumerate(sorted_broll):
        bstart = float(clip["start"])
        if bstart >= th_duration:
            continue
        actual_dur = broll_durations[i]
        bend = min(float(clip["end"]), bstart + actual_dur, th_duration)
        if bend <= bstart:
            continue
        if prev_end < bstart:
            segments.append({"type": "th", "start": prev_end, "end": bstart})
        segments.append({"type": "broll", "index": i, "start": bstart, "end": bend, "duration": bend - bstart})
        prev_end = bend

    if prev_end < th_duration:
        segments.append({"type": "th", "start": prev_end, "end": th_duration})

    inputs = ["-i", talking_head_path]
    for clip in sorted_broll:
        inputs.extend(["-i", clip["path"]])

    filter_parts = []
    concat_parts = []
    norm = "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1"

    for j, seg in enumerate(segments):
        if seg["type"] == "th":
            filter_parts.append(f"[0:v]trim=start={seg['start']:.3f}:end={seg['end']:.3f},setpts=PTS-STARTPTS,{norm}[tv{j}]")
            filter_parts.append(f"[0:a]atrim=start={seg['start']:.3f}:end={seg['end']:.3f},asetpts=PTS-STARTPTS[ta{j}]")
            concat_parts.append(f"[tv{j}][ta{j}]")
        else:
            idx = seg["index"] + 1
            dur = seg["duration"]
            filter_parts.append(f"[{idx}:v]trim=start=0:end={dur:.3f},setpts=PTS-STARTPTS,{norm}[bv{j}]")
            filter_parts.append(f"[0:a]atrim=start={seg['start']:.3f}:end={seg['end']:.3f},asetpts=PTS-STARTPTS[ba{j}]")
            concat_parts.append(f"[bv{j}][ba{j}]")

    n = len(segments)
    filter_parts.append(f"{''.join(concat_parts)}concat=n={n}:v=1:a=1[outv][outa]")
    filter_parts.append(f"[outv]{sub_filter}[finalv]")
    filter_str = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y", "-v", "error",
        *inputs,
        "-filter_complex", filter_str,
        "-map", "[finalv]",
        "-map", "[outa]",
        *video_encode_args(DELIVERY),
        "-c:a", "aac", "-b:a", "128k",
        output_path,
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        # Fallback without subtitle filter if Windows path escaping inside filter_complex fails
        filter_str_nosub = ";".join(filter_parts[:-1])
        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                *inputs,
                "-filter_complex", filter_str_nosub,
                "-map", "[outv]",
                "-map", "[outa]",
                *video_encode_args(DELIVERY),
                "-c:a", "aac", "-b:a", "128k",
                output_path,
            ],
            check=True,
        )
    return output_path


def generate_full_video(
    script: dict,
    config: dict,
    output_dir: str,
    log: Callable[[str], None] = print,
) -> dict:
    """Full 100% Free SaaSShorts video generation pipeline."""
    os.makedirs(output_dir, exist_ok=True)
    fal_key = config.get("fal_key", "")
    elevenlabs_key = config.get("elevenlabs_key", "")
    voice_id = config.get("voice_id", "en-US-AvaMultilingualNeural")
    actor_desc = config.get("actor_description") or script.get(
        "actor_description",
        "a young professional in their late 20s at a modern studio desk",
    )

    title_slug = re.sub(r"[^a-z0-9]+", "_", script.get("title", "video").lower())[:30] or "short"
    actor_img = os.path.join(output_dir, f"{title_slug}_actor.png")
    audio_path = os.path.join(output_dir, f"{title_slug}_voice.mp3")
    talking_head = os.path.join(output_dir, f"{title_slug}_head.mp4")
    srt_path = os.path.join(output_dir, f"{title_slug}_subs.ass")
    final_path = os.path.join(output_dir, f"{title_slug}_final.mp4")

    full_narration = script.get("full_narration", "") or " ".join(
        seg.get("narration", "") for seg in script.get("segments", [])
    )

    def _exists(path):
        return os.path.exists(path) and os.path.getsize(path) > 0

    selected_actor = config.get("selected_actor_path")
    if selected_actor and os.path.exists(selected_actor) and not _exists(actor_img):
        import shutil
        shutil.copy2(selected_actor, actor_img)
        log("[1/6] Using pre-selected presenter portrait.")

    need_img = not _exists(actor_img)
    need_voice = not _exists(audio_path)

    if need_img or need_voice:
        log("[1/6] Generating presenter portrait + free neural voiceover (parallel)...")
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_img = executor.submit(generate_actor_image, actor_desc, fal_key, actor_img) if need_img else None
            future_voice = executor.submit(generate_voiceover, full_narration, elevenlabs_key, audio_path, voice_id) if need_voice else None
            if future_img:
                actor_img = future_img.result()
            if future_voice:
                audio_path = future_voice.result()
        log("[2/6] Presenter portrait and neural voiceover ready.")
    else:
        log("[1/6] Using cached presenter portrait and voiceover.")

    if not _exists(talking_head):
        log("[3/6] Animating presenter scene with FFmpeg...")
        talking_head = generate_talking_head(actor_img, audio_path, fal_key, talking_head)
        log("[3/6] Presenter animation ready.")

    broll_segments = [
        seg for seg in script.get("segments", [])
        if seg.get("broll_prompt") and seg.get("visual") == "broll"
    ]
    broll_clips = []
    for i, seg in enumerate(broll_segments):
        broll_path = os.path.join(output_dir, f"{title_slug}_broll_{i}.mp4")
        if not _exists(broll_path):
            log(f"[4/6] Generating B-roll clip {i + 1}/{len(broll_segments)}...")
            try:
                generate_broll(seg["broll_prompt"], fal_key, broll_path)
            except Exception as e:
                log(f"  B-roll {i + 1} skipped: {e}")
                continue
        broll_clips.append({"path": broll_path, "start": seg["start"], "end": seg["end"]})

    log("[5/6] Generating word-level TikTok subtitles...")
    generate_tiktok_subs(audio_path, srt_path, max_words=2, fallback_text=full_narration)

    log("[6/6] Compositing final vertical 9:16 video with FFmpeg...")
    hook_text = script.get("hook_text", "")
    composite_video(talking_head, broll_clips, srt_path, hook_text, final_path)
    mark_ai_generated(final_path, "AI presenter, neural voiceover and generated b-roll")
    log("Video generation complete (100% Free)!")

    audio_duration = _get_media_duration(audio_path)
    cost = {
        "actor_image_flux_free": 0.00,
        "voiceover_edge_neural_free": 0.00,
        "broll_flux_free": 0.00,
        "ffmpeg_compositing": 0.00,
        "total": 0.00,
    }
    return {
        "video_path": final_path,
        "video_filename": os.path.basename(final_path),
        "srt_path": srt_path,
        "actor_image": actor_img,
        "duration": audio_duration,
        "cost_estimate": cost,
    }
