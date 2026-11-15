# Clarity — 100% Free AI Video Clipper, CapCut Pro Studio & Autonomous Shorts Suite

**Clarity** is an all-in-one, 100% free and open-source AI video clipping, post-production, voice dubbing, live stream clipping, and UGC Shorts creation platform. Every feature runs with **zero subscription walls, zero watermarks, and zero required paid third-party APIs ($0.00 cost)**.

---

## Complete Feature Catalog

### 1. AI Viral Clip Generator & Multimodal Reframing
- **Long-to-Short Viral Clip Extraction** (`main.py`, `gemini_worker.py`, `app.py`):
  - Paste any **YouTube**, **Twitch**, **Kick**, **TikTok**, **Rumble**, or direct video URL (via `yt-dlp`) or upload local `.mp4` / `.mov` / `.mkv` / `.webm` files.
  - **Local Faster-Whisper Speech-to-Text**: Word-level timestamped transcription with Voice Activity Detection (`silero-vad`) across 30+ languages.
  - **AI Viral Moment Scoring**: Multimodal and transcript-aware scoring of hooks, emotional peaks, humor, insights, and story arcs, plus platform-ready titles, descriptions, and hashtags for YouTube Shorts, TikTok, and Instagram Reels.
- **Smart Vertical Reframing (9:16)** (`reframe_v2.py`, `split_layout.py`, `panel_layout.py`, `wide_layout.py`, `ReframeEditor.jsx`):
  - **YOLO + MediaPipe Face & Lip-Sync Speaker Tracking**: Automatically tracks the active speaker and locks camera pan/crop without jitter.
  - **Multi-Speaker Split-Screen & Grid Layouts**: Automatic 2-speaker stacked split-screen and 3/4-speaker podcast panel layouts.
  - **Screencast / Presentation Layout**: Detects screen-shares and gameplay to compose speaker webcam + wide content canvas.
  - **Interactive Reframe Editor**: Scrub through the clip and override framing modes (`Auto`, `Split`, `Full Frame`, or custom crop coordinates) per scene.
- **Word-Snapped Non-Linear Clip Editor** (`ClipEditor.jsx`):
  - Three-point source monitor editing (`Mark IN` / `Mark OUT`), word-snapped transcript trimming, segment reordering, splitting, and instant re-rendering.

---

### 2. CapCut Pro Studio — Multi-Layer Editor, VFX, Audio & AI Suite (`capcut_studio.py`, `CapCutStudioTab.jsx`)

#### Timeline & Basic Editing
- **Multi-Layer Timeline Controls**:
  - Dedicated tracks for **Markers & Beats (`M1`)**, **Video Segments (`V1`)**, **Text & Sticker Overlays (`T1`)**, and **Audio / Music / SFX / Voiceover (`A1`)**.
  - Full **Undo / Redo** history stack, **Split at Playhead**, **Trim IN/OUT**, **Merge Segments**, **Duplicate**, and **Delete**.
- **Timeline Markers & Auto-Beat Detection** (`POST /api/studio/detect-beats`):
  - Place custom edit markers at any playhead timestamp.
  - **Automatic Music Beat Detection**: Computes 100Hz audio energy flux to detect exact BPM and downbeats, renders beat markers on the timeline, and provides a one-click **"Snap Cuts to Beats"** action.
- **Speed Curves, Optical Flow & Footage Controls**:
  - Constant speed (`0.25x` – `4.0x`) + **7 CapCut Velocity Curve Presets**: *Constant*, *Montage*, *Hero Time*, *Bullet Time*, *Jump Cut Velocity*, *Flash In*, and *Flash Out*.
  - **Smooth Slow-Motion (Optical Flow)**: Motion-compensated frame interpolation (`minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`).
  - **Freeze Frame** (`1.5s` frame clone at playhead), **Reverse Footage** (`reverse` + `areverse`), **Mirror Horizontal (`hflip`)**, **Flip Vertical (`vflip`)**, **90°/180°/270° Rotation**, and **Aspect Ratio Crop (`9:16`, `1:1`, `16:9`, `4:5`)**.
- **Transform & Keyframing**:
  - Add position, scale/zoom, and rotation keyframes at any playhead timestamp or enable automatic dynamic keyframe zoom motion.

#### Video Effects, Filters, Masks & Transitions
- **Filters, LUTs & HSL Color Grading**:
  - **16 Built-in Video Filter & LUT Presets**: *Teal & Orange*, *Cyberpunk Neon*, *Vintage Kodak*, *Golden Hour*, *Moody Matte*, *Noir B&W*, *Vibrant TikTok Pop*, *Arctic Blue*, *1920s Sepia*, *90s Camcorder*, *Emerald Matrix*, *Pastel Soft*, *HDR Clarity*, *Night Vision*, and *Bleach Bypass*.
  - **HSL & Color Sliders**: Brightness, Contrast, Saturation, Hue shift (`-90°..+90°`), Warmth/Temperature, Tint, Sharpness, and Vignette.
  - **One-Click Auto Color Grading** (`POST /api/studio/auto-color`): Analyzes video frame luminance and RGB histograms to auto-calibrate exposure, contrast, saturation, and white balance.
- **Video VFX, Body/Face Effects & Transitions**:
  - **12 Video & Body/Face Effects**: *RGB Glitch Split*, *Handheld Impact Camera Shake*, *VHS Glitch & Grain*, *Dreamy Glow / Halation*, *Motion Trail Blur*, *Retro 8-Bit Pixelate*, *Beat Zoom Pulse*, *Neon Body Outline*, *Face Beauty / Skin Smooth*, *Subject Spotlight Vignette*, *Clone Ghost Trail*, and *35mm Film Grain*.
  - **13 Video Transitions (`xfade`)**: *Hard Cut*, *Cross Dissolve*, *Whip Pan Left*, *Whip Pan Right*, *Circle Iris Open*, *Circle Iris Close*, *Pixel Glitch*, *Flash White*, *Dip to Black*, *Swipe Up*, *Swipe Down*, *Clock Radial*, and *Smooth Push Left*.
- **Masks & Chroma Key (Green Screen)**:
  - **Masks**: *Cinematic Filmstrip Bars*, *Circle Subject Spotlight*, and *Mirror Split Screen*.
  - **Chroma Key**: Custom key color picker + similarity and edge blend sliders (`colorkey`).

#### Text, Captions, Stickers & AI Character TTS
- **Text Layers, Viral Templates & Stickers**:
  - Multi-layer custom text banners with custom font color, background pill color, size, and vertical/horizontal placement.
  - **6 Trending Text Templates**: *"WAIT FOR IT... 👀"*, *"POV: Hook"*, *"🚨 BREAKING NEWS 🚨"*, *"99% OF PEOPLE DON'T KNOW THIS 💡"*, *"PART 1"*, and *"WATCH TILL THE END 🔥"*.
  - **12 Sticker & Callout Overlays**: Emoji & badge stickers (`🔥`, `💀`, `🤯`, `💯`, `🚀`, `👀`, `⚡`, `💡`, `🎯`, `❤️`, `🔔 SUBSCRIBE`, `👍 LIKE`).
- **Auto Captions & Karaoke Styles** (`SubtitleModal.jsx`, `RemotionPreview.jsx`):
  - Animated word-by-word karaoke subtitles with customizable fonts, highlight colors, Hook banners (`HookModal.jsx`), and browser or FFmpeg ASS rendering.
- **AI Caption Word Fixer & Hinglish/Urdu Romanizer** (`roman.py`, `ai_hub.py`, `POST /api/clip/fix-captions`):
  - Fixes ASR mishearings, brand names, numbers, and punctuation, and transliterates Hindi (Devanagari) & Urdu (Arabic) script into Roman letters ("Hinglish") while keeping exact word timestamps.
- **Text-to-Speech (TTS) & AI Character Voiceovers** (`POST /api/studio/tts`):
  - Converts written text into natural speech or **8 Character Voices** (*Ava Creator*, *Andrew Storyteller*, *Epic Movie Trailer Guy*, *Emma Hype*, *Ryan British Documentary*, *Chipmunk Comedy*, *NEXUS Cyber Robot*, *Vintage Radio Announcer*) using free `edge-tts` + FFmpeg DSP pitch/timbre shaping.

#### Audio, Royalty-Free Music & Voice Enhancement
- **Built-in Royalty-Free Background Music & Viral SFX Synthesizer** (`GET /api/studio/audio/{kind}/{asset_id}`):
  - **6 Royalty-Free Background Music Loops**: *Lo-Fi Study Chill Beat (84 BPM)*, *Drift Phonk Cowbell Bass (135 BPM)*, *Cinematic Dark Tension Pulse (96 BPM)*, *Upbeat Creator Trap (140 BPM)*, *Midnight Synthwave Arpeggio (118 BPM)*, and *Warm Storytelling Pad (76 BPM)*.
  - **10 Viral Sound Effects (SFX)**: *Vine Boom Bass Drop*, *Cinematic Whoosh Swipe*, *Deep Cinema Sub Drop*, *Cyber Glitch Riser*, *Bright Notification Ding*, *Ka-Ching Cash Register*, *Vinyl Record Scratch*, *DSLR Camera Shutter*, *Text Pop Bubble*, and *Broadcast Censor Beep*.
- **Studio Voice Enhancement & Creative Voice Effects**:
  - **FFT Background Noise Removal** (`afftdn`), **Vocal Isolation**, and **Studio Podcast Vocal Polish** (Highpass + Presence EQ + Dynamic Compressor + EBU R128 `loudnorm`).
  - **8 Creative Voice Effects**: *Original*, *Studio Podcast Polish*, *Deep Movie Trailer*, *Helium Chipmunk*, *Cyber Robot*, *Lo-Fi Radio / Megaphone*, *Cathedral Reverb Echo*, *Dark Monster*, and *Slowed + Reverb (Vaporwave)*.

#### AI Smart Tools & Trending Templates
- **AI Background Removal (Without Green Screen)** (`POST /api/studio/remove-bg`):
  - Automatically isolates the foreground subject and replaces the background with **Portrait Bokeh Blur** or a **Solid Studio / Virtual Backdrop** without needing a physical green screen.
- **AI Video Quality Enhancer & Upscaler** (`POST /api/studio/upscale`):
  - Upscales low-resolution footage to **1080p Full HD**, **2K QHD**, or **4K UHD** with Lanczos super-sampling, 3D temporal denoising (`hqdn3d`), Contrast Adaptive Sharpening, and optional **60fps motion interpolation**.
- **Smart Silence & Pause Remover** (`POST /api/studio/remove-silence`):
  - Detects dead air and pauses in spoken dialogue (`silencedetect`) and automatically slices the timeline into tight jump-cuts.
- **AI Edit Pilot (Post-Production Assistant)** (`POST /api/studio/edit-pilot`):
  - Analyzes transcript hooks, musical beats, silent pauses, and lighting histograms to automatically configure color grading, zoom keyframes, hook overlays, and audio in one click.
- **8 One-Click Trending Video Templates**:
  - *Hormozi Viral Podcast*, *Velocity Beat Edit*, *Dark Motivation Aesthetic*, *Cyber Tech Product Reveal*, *Golden Hour Travel Reel*, *Gym Phonk Impact Edit*, *Breaking News Viral Hook*, and *90s Camcorder Storytime*.

---

### 3. Free AI Voice Dubbing & Video Translation (31+ Languages)
- **Neural Voice Dubbing** (`translate.py`, `TranslateModal.jsx`, `POST /api/translate`):
  - Translates and dubs any video clip into **31+ languages** (*English, Spanish, French, German, Italian, Portuguese, Polish, Hindi, Japanese, Korean, Chinese, Arabic, Russian, Turkish, Dutch, Swedish, Indonesian, Filipino, Malay, Vietnamese, Thai, Ukrainian, Greek, Czech, Finnish, Romanian, Danish, Bulgarian, Croatian, Slovak, Tamil*).
  - Uses local Whisper transcription + Clarity's Multi-AI Hub (with keyless Google Translate fallback) + **Microsoft Edge Neural TTS (`edge-tts`)** + FFmpeg tempo cadence alignment and original background audio ducking.

---

### 4. Free AI Shorts / UGC Video Creator & Showcase Gallery
- **URL / Topic to Viral Faceless or Presenter Short** (`saasshorts.py`, `SaaShortsTab.jsx`, `UGCGallery.jsx`):
  - Scrapes and analyzes any product URL or topic using Clarity's AI Hub.
  - Generates 5-segment viral scripts (`Hook -> Problem -> Solution -> Demo -> CTA`).
  - Generates AI presenter portraits & cinematic B-roll via keyless **Flux** (`image.pollinations.ai`) with local Pillow HD storyboard fallback.
  - Synthesizes multi-speaker neural voiceovers via `edge-tts` and composites 9:16 video with breathing-zoom animation, Ken Burns B-roll, and TikTok ASS subtitles (`$0.00 / video`).

---

### 5. Channel Autopilot, Creator Workspaces & Real-Time Live Stream Clipper
- **Free Channel Autopilot** (`live_clipper.py`, `AutopilotTab.jsx`, `/api/autopilot/*`):
  - Monitors any **YouTube**, **Twitch**, or **Kick** channel via `yt-dlp` and automatically queues new videos for clipping.
- **Real-Time Live Stream Recorder & Clipper** (`/api/live/*`):
  - Connects to live **YouTube**, **Twitch**, or **Kick** streams with a rolling 6-second MPEG-TS segment buffer.
  - Automatically triggers clips on **audio loudness dB spikes** and **anonymous Twitch IRC live chat velocity spikes**, or via manual **"Clip Last 30s / 45s / 60s / 90s"** buttons.
- **Creator Workspaces** (`/api/creators/*`):
  - Organize channels, brand presets, and clip history by creator profile.

---

### 6. Multi-AI Provider Hub, Offline Mode & Local Ollama Manager
- **10 Supported AI Providers / Modes** (`ai_hub.py`, `AIHubTab.jsx`, `/api/ai/*`):
  1. **Google Gemini** (Free AI Studio key)
  2. **Ollama (100% Local & Free — No API Key Required)**
  3. **Groq** (Fast LPU & Free Tier)
  4. **DeepSeek**
  5. **OpenRouter** (Free & Paid Models)
  6. **OpenAI**
  7. **Claude (Anthropic)**
  8. **Grok (xAI)**
  9. **Custom OpenAI-Compatible Endpoint** (`vLLM`, `LM Studio`, `llama.cpp`)
  10. **No AI — Audio Loudness Peaks Only (100% Offline)**: Picks highlight clips purely from audio reaction z-scores with zero LLM calls.
- **One-Click Local Ollama Model Puller & Environment Health Checker**:
  - Inspect `ffmpeg`, `ffprobe`, `yt-dlp`, `faster-whisper`, `edge-tts`, and `ollama` status, and pull local models (`llama3.2`, `qwen2.5:7b`, `deepseek-r1:7b`, `mistral`, `gemma2:9b`) from the dashboard.
- **AI Token & Call Usage Tracker & YouTube Copyright License Checker**:
  - Track input/output token usage across providers and inspect YouTube video Creative Commons / reuse license status (`POST /api/youtube/copyright-check`).

---

### 7. YouTube Thumbnail Studio, History Library, Social Publishing & CLI/MCP
- **AI YouTube Thumbnail Studio** (`thumbnails.py`, `ThumbnailStudio.jsx`):
  - Face reference extraction, viral thumbnail composition, and A/B variants.
- **Local Project & Clip History Library** (`HistoryTab.jsx`, `/api/history`, `/api/projects`):
  - Browse, search, rename, delete, download, and reopen any past project directly from local disk (`outputs/`).
- **Social Publishing & Weekly Scheduler** (`ScheduleWeekModal.jsx`, `/api/social/*`):
  - Optional direct posting and weekly calendar scheduling to TikTok, Instagram Reels, and YouTube Shorts.
- **CLI & MCP Server** (`cli/`, `mcp_server.py`):
  - Command-line interface and Model Context Protocol (MCP) server for autonomous AI agents.

---

## Quick Start

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **FFmpeg** (with `ffprobe` on `PATH`)

### 2. Backend Setup
```bash
pip install -r requirements.txt
python app.py
```
The FastAPI server starts on `http://localhost:8000`.

### 3. Frontend Setup
```bash
cd dashboard
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. Running Tests
```bash
python -m pytest tests/test_free_features.py tests/test_llm_backend.py -v
cd dashboard && npm run lint && npm run build
```

---

## License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](./LICENSE) for full details.

