"""Unified Multi-AI Provider Hub, Local Ollama Manager, Usage Tracker & Caption Brain.

Combines:
- PeakCut's multi-provider AI engine (`studio/ai.py`), token usage tracker (`studio/usage.py`),
  loudness-based no-AI fallback, and caption word fixer/translator (`studio/brain.py`)
- AutoShorts's DeepSeek/OpenRouter/Groq/Ollama engine (`src-tauri/src/llm.rs`),
  environment checker, Ollama model puller, and YouTube copyright checker (`src-tauri/src/lib.rs`).
"""
import difflib
import json
import os
import re
import shutil
import subprocess
import threading
import time
from collections import defaultdict
from pathlib import Path
from typing import Optional

import httpx
import numpy as np

import roman

DATA_DIR = Path(os.environ.get("CLARITY_DATA_DIR") or "outputs")
AI_SETTINGS_FILE = DATA_DIR / "ai_settings.json"
AI_USAGE_FILE = DATA_DIR / "ai_usage.json"

# id -> (label, default base URL, protocol, key URL, example model)
PROVIDERS = {
    "gemini": (
        "Google Gemini",
        "https://generativelanguage.googleapis.com/v1beta/models",
        "gemini",
        "https://aistudio.google.com/apikey",
        "gemini-2.5-flash",
    ),
    "ollama": (
        "Ollama (100% Local & Free)",
        "http://127.0.0.1:11434/v1",
        "openai",
        "https://ollama.com",
        "llama3.2",
    ),
    "groq": (
        "Groq (Fast & Free Tier)",
        "https://api.groq.com/openai/v1",
        "openai",
        "https://console.groq.com/keys",
        "llama-3.3-70b-versatile",
    ),
    "deepseek": (
        "DeepSeek",
        "https://api.deepseek.com",
        "openai",
        "https://platform.deepseek.com",
        "deepseek-chat",
    ),
    "openrouter": (
        "OpenRouter (Free & Paid Models)",
        "https://openrouter.ai/api/v1",
        "openai",
        "https://openrouter.ai/keys",
        "google/gemini-2.5-flash",
    ),
    "openai": (
        "OpenAI",
        "https://api.openai.com/v1",
        "openai",
        "https://platform.openai.com/api-keys",
        "gpt-4o-mini",
    ),
    "anthropic": (
        "Claude (Anthropic)",
        "https://api.anthropic.com/v1",
        "anthropic",
        "https://console.anthropic.com",
        "claude-3-5-sonnet-latest",
    ),
    "xai": (
        "Grok (xAI)",
        "https://api.x.ai/v1",
        "openai",
        "https://console.x.ai",
        "grok-3-mini",
    ),
    "custom": (
        "Custom (OpenAI-compatible)",
        "",
        "openai",
        "",
        "local-model",
    ),
    "loudness": (
        "No AI (Audio Loudness Peaks Only — 100% Offline)",
        "",
        "loudness",
        "",
        "loudness-zscore",
    ),
}

ALIASES = {
    "google": "gemini",
    "grok": "xai",
    "claude": "anthropic",
    "local": "ollama",
}
NO_KEY = {"ollama", "custom", "loudness"}

_lock = threading.RLock()
_usage_lock = threading.RLock()


def _read_saved() -> dict:
    try:
        if AI_SETTINGS_FILE.exists():
            data = json.loads(AI_SETTINGS_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return {}


def current_settings(override_gemini_key: str = "") -> dict:
    """Return active AI provider, models, base_url, and key."""
    d = _read_saved()
    env_provider = (
        os.environ.get("CLARITY_AI_PROVIDER")
        or os.environ.get("PEAKCUT_AI_PROVIDER")
        or os.environ.get("LLM_PROVIDER")
        or "gemini"
    ).strip().lower()
    p = str(d.get("provider") or env_provider).strip().lower()
    p = ALIASES.get(p, p)
    if p not in PROVIDERS:
        p = "gemini"

    default_model = PROVIDERS[p][4]
    env_models = (
        os.environ.get("CLARITY_AI_MODELS")
        or os.environ.get("PEAKCUT_AI_MODELS")
        or os.environ.get("GEMINI_MODEL")
        or default_model
    )
    models = (
        list(d["models"])
        if d.get("provider") and d.get("models")
        else [m.strip() for m in env_models.split(",") if m.strip()]
    )
    if not models and default_model:
        models = [default_model]

    base_url = (
        str(d.get("base_url") or "")
        if d.get("provider")
        else os.environ.get("CLARITY_AI_BASE_URL", "")
    ).rstrip("/")
    if not base_url:
        base_url = PROVIDERS[p][1]

    env_key_map = {
        "gemini": override_gemini_key or os.environ.get("GEMINI_API_KEY", ""),
        "groq": os.environ.get("GROQ_API_KEY", ""),
        "deepseek": os.environ.get("DEEPSEEK_API_KEY", ""),
        "openrouter": os.environ.get("OPENROUTER_API_KEY", ""),
        "openai": os.environ.get("OPENAI_API_KEY", ""),
        "anthropic": os.environ.get("ANTHROPIC_API_KEY", ""),
        "xai": os.environ.get("XAI_API_KEY", ""),
    }
    saved_key = str(d.get("key") or "") if d.get("provider") == p else ""
    key = saved_key or env_key_map.get(p, "") or override_gemini_key or os.environ.get("CLARITY_AI_KEY", "")

    return {
        "provider": p,
        "models": models,
        "base_url": base_url,
        "key": key,
    }


def is_ready(override_gemini_key: str = "") -> bool:
    c = current_settings(override_gemini_key)
    p = c["provider"]
    if p == "loudness":
        return True
    return bool(
        p in PROVIDERS
        and c["models"]
        and c["base_url"]
        and (c["key"] or p in NO_KEY)
    )


def public_settings(override_gemini_key: str = "") -> dict:
    c = current_settings(override_gemini_key)
    p = c["provider"]
    return {
        "provider": p,
        "models": c["models"],
        "base_url": c["base_url"],
        "has_key": bool(c["key"]),
        "key_hint": c["key"][-4:] if len(c["key"]) >= 8 else "",
        "ready": is_ready(override_gemini_key),
        "label": PROVIDERS.get(p, ("",))[0],
        "saved_here": bool(_read_saved().get("provider")),
        "providers": [
            {
                "id": k,
                "label": v[0],
                "address": v[1],
                "needs_key": k not in NO_KEY,
                "key_url": v[3],
                "example": v[4],
            }
            for k, v in PROVIDERS.items()
        ],
    }


def save_settings(provider_id: str, model_ids, address: str = "", new_key: Optional[str] = None) -> dict:
    p = ALIASES.get(str(provider_id or "").strip().lower(), str(provider_id or "").strip().lower())
    if p not in PROVIDERS:
        raise ValueError("Choose one of the supported AI providers.")
    if isinstance(model_ids, str):
        model_ids = model_ids.split(",")
    ms = [str(m).strip()[:120] for m in (model_ids or []) if str(m).strip()][:5]
    if not ms:
        ms = [PROVIDERS[p][4] or "default"]
    address = str(address or "").strip().rstrip("/")[:300]
    if p == "custom" and not address:
        raise ValueError("A custom service needs its base URL, e.g. http://127.0.0.1:1234/v1")

    old = current_settings()
    k = (
        old["key"]
        if new_key is None and old["provider"] == p
        else str(new_key or "").strip()[:400]
    )
    with _lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp = AI_SETTINGS_FILE.with_suffix(".tmp")
        tmp.write_text(
            json.dumps({"provider": p, "models": ms, "base_url": address, "key": k}, indent=2),
            encoding="utf-8",
        )
        tmp.replace(AI_SETTINGS_FILE)
    return public_settings()


def list_models(provider_id: Optional[str] = None, address: Optional[str] = None, with_key: Optional[str] = None) -> list:
    c = current_settings()
    p = ALIASES.get(str(provider_id or c["provider"]).lower(), str(provider_id or c["provider"]).lower())
    if p not in PROVIDERS:
        raise ValueError("Unsupported provider.")
    if p == "loudness":
        return ["loudness-zscore"]
    k = str(with_key or "").strip() or (c["key"] if c["provider"] == p else "")
    base = str(address or "").strip().rstrip("/") or (c["base_url"] if c["provider"] == p else "") or PROVIDERS[p][1]
    if not base:
        raise ValueError("Enter the service's base URL first.")
    how = PROVIDERS[p][2]
    if how == "gemini":
        r = httpx.get(base, params={"pageSize": 200}, headers={"x-goog-api-key": k}, timeout=15)
    elif how == "anthropic":
        r = httpx.get(
            f"{base}/models",
            params={"limit": 200},
            headers={"x-api-key": k, "anthropic-version": "2023-06-01"},
            timeout=15,
        )
    else:
        r = httpx.get(f"{base}/models", headers={"Authorization": f"Bearer {k}"} if k else {}, timeout=15)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
    data = r.json()
    if how == "gemini":
        found = [
            m.get("name", "").split("/")[-1]
            for m in data.get("models", [])
            if "generateContent" in (m.get("supportedGenerationMethods") or [])
        ]
    else:
        found = [m.get("id", "") for m in data.get("data", []) if isinstance(m, dict)]
    return sorted({m for m in found if m})[:400]


# ---------------------------------------------------------------- Usage tracking (from PeakCut studio/usage.py)
def record_usage(tokens_in: int, tokens_out: int, purpose: str, provider: str = "", model: str = "", place: str = ""):
    with _usage_lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        rows = []
        if AI_USAGE_FILE.exists():
            try:
                rows = json.loads(AI_USAGE_FILE.read_text(encoding="utf-8"))
                if not isinstance(rows, list):
                    rows = []
            except Exception:
                rows = []
        rows.append({
            "t": time.time(),
            "tokens_in": max(0, int(tokens_in)),
            "tokens_out": max(0, int(tokens_out)),
            "purpose": str(purpose or "AI call")[:80],
            "provider": provider,
            "model": model,
            "where": str(place or "")[:160],
        })
        # Keep most recent 1000 records
        rows = rows[-1000:]
        AI_USAGE_FILE.write_text(json.dumps(rows), encoding="utf-8")


def usage_summary(override_gemini_key: str = "") -> dict:
    rows = []
    if AI_USAGE_FILE.exists():
        try:
            rows = json.loads(AI_USAGE_FILE.read_text(encoding="utf-8"))
            if not isinstance(rows, list):
                rows = []
        except Exception:
            rows = []

    now = time.time()
    midnight = time.mktime(time.localtime(now)[:3] + (0, 0, 0, 0, 0, -1))
    today_calls = 0
    today_tokens = 0
    total_tokens = 0
    by_purpose = defaultdict(lambda: [0, 0])
    days = [time.strftime("%Y-%m-%d", time.localtime(now - 86400 * i)) for i in range(13, -1, -1)]
    daily = {d: [0, 0] for d in days}

    for r in rows:
        t = float(r.get("t", 0))
        tok = int(r.get("tokens_in", 0)) + int(r.get("tokens_out", 0))
        total_tokens += tok
        if t >= midnight:
            today_calls += 1
            today_tokens += tok
        p = r.get("purpose", "AI call")
        by_purpose[p][0] += tok
        by_purpose[p][1] += 1
        d_str = time.strftime("%Y-%m-%d", time.localtime(t))
        if d_str in daily:
            daily[d_str][0] += tok
            daily[d_str][1] += 1

    c = current_settings(override_gemini_key)
    return {
        "ready": is_ready(override_gemini_key),
        "provider": PROVIDERS.get(c["provider"], ("",))[0],
        "model": (c["models"] or [""])[0],
        "today_calls": today_calls,
        "today_tokens": today_tokens,
        "calls_total": len(rows),
        "tokens_total": total_tokens,
        "daily": [{"day": d, "tokens": daily[d][0], "calls": daily[d][1]} for d in days],
        "by_purpose": sorted(
            [[k, v[0], v[1]] for k, v in by_purpose.items()],
            key=lambda x: -x[1],
        ),
        "recent": [
            {
                "t": r.get("t", 0),
                "tokens": int(r.get("tokens_in", 0)) + int(r.get("tokens_out", 0)),
                "purpose": r.get("purpose", ""),
                "provider": r.get("provider", ""),
                "model": r.get("model", ""),
                "where": r.get("where", ""),
            }
            for r in reversed(rows[-50:])
        ],
    }


# ---------------------------------------------------------------- JSON AI Caller (PeakCut + AutoShorts)
def _json_schema(s):
    if isinstance(s, dict):
        return {k: (v.lower() if k == "type" and isinstance(v, str) else _json_schema(v)) for k, v in s.items()}
    if isinstance(s, list):
        return [_json_schema(x) for x in s]
    return s


def _wrapped_prompt(prompt: str, schema: Optional[dict]) -> str:
    if not schema:
        return prompt + "\n\nRespond with valid JSON only, no markdown fences."
    return (
        prompt
        + '\n\nAnswer with JSON only, no other text and no code fences: one object with a single key '
        '"items", whose value follows this JSON Schema:\n'
        + json.dumps(_json_schema(schema))
    )


def _parse_json_answer(text: str):
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    try:
        out = json.loads(text)
    except ValueError:
        m = re.search(r"[\[{].*[\]}]", text, re.S)
        if not m:
            raise RuntimeError("The AI did not answer with valid JSON.")
        out = json.loads(m.group(0))
    if isinstance(out, dict) and "items" in out:
        out = out["items"]
    return out


def call_ai(
    prompt: str,
    schema: Optional[dict] = None,
    purpose: str = "AI call",
    override_gemini_key: str = "",
    place: str = "",
):
    """Call the active AI provider (or fallback to Gemini if override_gemini_key is passed)."""
    c = current_settings(override_gemini_key)
    p = c["provider"]
    if p == "loudness":
        raise RuntimeError("Loudness-only mode is active (no AI calls).")
    if not c["key"] and p not in NO_KEY and override_gemini_key:
        p = "gemini"
        c = {
            "provider": "gemini",
            "models": ["gemini-2.5-flash"],
            "base_url": PROVIDERS["gemini"][1],
            "key": override_gemini_key,
        }

    how = PROVIDERS[p][2]
    base = c["base_url"] or PROVIDERS[p][1]
    k = c["key"]
    last_err = None

    for model in c["models"]:
        for attempt in range(2):
            try:
                if how == "gemini":
                    gen_cfg = {"temperature": 0.3, "responseMimeType": "application/json"}
                    if schema:
                        gen_cfg["responseSchema"] = schema
                    body = {
                        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                        "generationConfig": gen_cfg,
                    }
                    r = httpx.post(
                        f"{base}/{model}:generateContent",
                        json=body,
                        headers={"x-goog-api-key": k},
                        timeout=120,
                    )
                    if r.status_code != 200:
                        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:250]}")
                    data = r.json()
                    text = "".join(
                        part.get("text", "")
                        for part in data["candidates"][0]["content"]["parts"]
                    )
                    u = data.get("usageMetadata", {})
                    sent = int(u.get("promptTokenCount") or 0)
                    wrote = max(0, int(u.get("totalTokenCount") or 0) - sent)
                    parsed = _parse_json_answer(text)
                elif how == "anthropic":
                    body = {
                        "model": model,
                        "max_tokens": 8192,
                        "messages": [{"role": "user", "content": _wrapped_prompt(prompt, schema)}],
                    }
                    r = httpx.post(
                        f"{base}/messages",
                        json=body,
                        headers={"x-api-key": k, "anthropic-version": "2023-06-01"},
                        timeout=180,
                    )
                    if r.status_code != 200:
                        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:250]}")
                    data = r.json()
                    text = "".join(
                        b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"
                    )
                    u = data.get("usage") or {}
                    sent = int(u.get("input_tokens") or 0)
                    wrote = int(u.get("output_tokens") or 0)
                    parsed = _parse_json_answer(text)
                else:
                    headers = {"Authorization": f"Bearer {k}"} if k else {}
                    body = {
                        "model": model,
                        "messages": [{"role": "user", "content": _wrapped_prompt(prompt, schema)}],
                    }
                    extras = [
                        {"temperature": 0.3, "response_format": {"type": "json_object"}},
                        {"response_format": {"type": "json_object"}},
                        {},
                    ]
                    r = None
                    for extra in extras:
                        r = httpx.post(
                            f"{base}/chat/completions",
                            json={**body, **extra},
                            headers=headers,
                            timeout=180,
                        )
                        if r.status_code not in (400, 422):
                            break
                    if r is None or r.status_code != 200:
                        raise RuntimeError(f"HTTP {r.status_code if r else 0}: {r.text[:250] if r else ''}")
                    data = r.json()
                    u = data.get("usage") or {}
                    sent = int(u.get("prompt_tokens") or 0)
                    wrote = int(u.get("completion_tokens") or 0)
                    parsed = _parse_json_answer(data["choices"][0]["message"].get("content", ""))

                record_usage(sent, wrote, purpose, provider=p, model=model, place=place)
                return parsed
            except Exception as e:
                last_err = e
                if "429" in str(e) or "503" in str(e):
                    time.sleep(2 * (attempt + 1))
                    continue
                break
    raise RuntimeError(f"AI call failed ({p}): {last_err}")


def test_connection(override_gemini_key: str = "") -> dict:
    c = current_settings(override_gemini_key)
    if c["provider"] == "loudness":
        return {"ok": True, "model": "loudness-zscore", "tokens": 0, "answer": "Loudness-only offline mode ready"}
    out = call_ai(
        'Answer with a JSON array that holds the single string "ok".',
        {"type": "ARRAY", "items": {"type": "STRING"}},
        purpose="Connection test",
        override_gemini_key=override_gemini_key,
    )
    return {"ok": True, "model": c["models"][0], "answer": str(out)[:80]}


# ---------------------------------------------------------------- AutoShorts Environment & Ollama Manager
def get_environment_status(override_gemini_key: str = "") -> dict:
    """Inspect local machine capabilities (FFmpeg, FFprobe, yt-dlp, Whisper, Edge-TTS, Ollama, API keys)."""
    has_ollama = False
    ollama_models = []
    try:
        r = httpx.get("http://127.0.0.1:11434/api/tags", timeout=1.5)
        if r.status_code == 200:
            has_ollama = True
            ollama_models = [m.get("name", "") for m in r.json().get("models", []) if m.get("name")]
    except Exception:
        pass

    has_edge_tts = False
    try:
        import edge_tts  # noqa: F401
        has_edge_tts = True
    except Exception:
        pass

    has_faster_whisper = False
    try:
        import faster_whisper  # noqa: F401
        has_faster_whisper = True
    except Exception:
        pass

    c = current_settings(override_gemini_key)
    return {
        "data_dir": str(DATA_DIR.resolve()),
        "has_ffmpeg": shutil.which("ffmpeg") is not None,
        "has_ffprobe": shutil.which("ffprobe") is not None,
        "has_ytdlp": shutil.which("yt-dlp") is not None,
        "has_local_whisper": has_faster_whisper or shutil.which("whisper") is not None,
        "has_edge_tts": has_edge_tts,
        "has_ollama": has_ollama,
        "ollama_models": ollama_models,
        "active_provider": c["provider"],
        "active_model": (c["models"] or [""])[0],
        "ai_ready": is_ready(override_gemini_key),
    }


def pull_ollama_model(model_name: str) -> dict:
    """Pull a local Ollama model (from AutoShorts pull_ollama_model)."""
    model_name = (model_name or "llama3.2").strip()
    try:
        r = httpx.post(
            "http://127.0.0.1:11434/api/pull",
            json={"name": model_name, "stream": False},
            timeout=600.0,
        )
        if r.status_code != 200:
            raise RuntimeError(f"Ollama returned HTTP {r.status_code}: {r.text[:200]}")
        return {"ok": True, "model": model_name, "status": "completed"}
    except Exception as e:
        raise RuntimeError(f"Failed to pull Ollama model '{model_name}': {e}")


# ---------------------------------------------------------------- AutoShorts YouTube Copyright Checker
def check_youtube_copyright(url: str) -> dict:
    """Check YouTube video license / Creative Commons status via yt-dlp (ported from AutoShorts)."""
    try:
        import yt_dlp
        opts = {"quiet": True, "no_warnings": True, "noplaylist": True, "skip_download": True}
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        lic = info.get("license") or "Standard YouTube License"
        is_safe = any(k in lic.lower() for k in ("creative commons", "reuse allowed", "cc by"))
        return {
            "is_safe": is_safe,
            "license": lic,
            "title": info.get("title") or "",
            "uploader": info.get("uploader") or info.get("channel") or "",
            "duration": info.get("duration") or 0,
        }
    except Exception as e:
        raise RuntimeError(f"Could not inspect YouTube license: {e}")


# ---------------------------------------------------------------- PeakCut Caption Fixer & Translator
FIX_SCHEMA = {"type": "ARRAY", "items": {"type": "STRING"}}


def _same_word(old: str, new: str) -> bool:
    a = re.sub(r"[^a-z0-9]", "", old.lower())
    b = re.sub(r"[^a-z0-9]", "", new.lower())
    return (
        (not b)
        or (any(ch.isdigit() for ch in b) and len(new) <= 12)
        or difflib.SequenceMatcher(None, a, b).ratio() >= 0.45
    )


def fix_caption_words(words: list, title: str = "", override_gemini_key: str = "") -> list:
    """Clean up a clip's caption wording and Romanize Hindi/Urdu ("Hinglish") using PeakCut's brain.py logic."""
    if not words:
        return words
    word_key = "w" if "w" in words[0] else "word"
    if len(words) >= 3 and is_ready(override_gemini_key) and current_settings(override_gemini_key)["provider"] != "loudness":
        numbered = "\n".join(f"{i}: {str(w.get(word_key, ''))[:60]}" for i, w in enumerate(words))
        prompt = (
            "These are the words of a short video clip's captions, one per line with its number, written by a speech "
            "model. Rewrite each word so the captions read correctly: numbers as digits (eleven -> 11, twenty five "
            "dollars -> $25), correct spelling of names and brands, fix obvious mishearings, capitalise sentence starts "
            "and proper names, add punctuation onto the word it follows. Do not reword or summarise. If a word is Hindi "
            "or Urdu, write that same word in Roman letters (Hinglish). Return a JSON array with EXACTLY one string per "
            f"input line, in the same order.\nVideo title: {title[:120]}\n\nWords ({len(words)}):\n{numbered}"
        )
        try:
            out = call_ai(prompt, FIX_SCHEMA, purpose="Caption wording fix", override_gemini_key=override_gemini_key)
            if isinstance(out, list) and len(out) == len(words):
                fixed = []
                for w, new in zip(words, out):
                    new_s = str(new or "").strip()
                    orig_s = str(w.get(word_key, ""))
                    if roman.needs_roman(orig_s) and new_s and not roman.needs_roman(new_s):
                        pass
                    elif len(new_s) > max(24, len(orig_s) * 4) or not _same_word(orig_s, new_s):
                        new_s = orig_s
                    if new_s:
                        fixed.append({**w, word_key: new_s})
                if fixed:
                    return roman.words(fixed)
        except Exception:
            pass
    return roman.words(words)


def translate_text_free(text: str, target_lang: str, source_lang: str = "auto", override_gemini_key: str = "") -> str:
    """Translate text to target_lang using configured AI or free Google Translate endpoint fallback."""
    text = (text or "").strip()
    if not text:
        return ""
    if is_ready(override_gemini_key) and current_settings(override_gemini_key)["provider"] != "loudness":
        try:
            prompt = (
                f"Translate the following spoken video transcript segment into {target_lang}. "
                "Keep the natural spoken tone, conciseness, and timing length suitable for voice dubbing. "
                "Return a JSON array containing a single translated string.\n\n"
                f"Text:\n{text}"
            )
            out = call_ai(prompt, FIX_SCHEMA, purpose=f"Translate ({target_lang})", override_gemini_key=override_gemini_key)
            if isinstance(out, list) and out and str(out[0]).strip():
                return str(out[0]).strip()
        except Exception:
            pass

    # Free keyless fallback via Google Translate gtx endpoint
    try:
        r = httpx.get(
            "https://translate.googleapis.com/translate_a/single",
            params={
                "client": "gtx",
                "sl": source_lang or "auto",
                "tl": target_lang,
                "dt": "t",
                "q": text,
            },
            timeout=15.0,
        )
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list) and data and isinstance(data[0], list):
                translated = "".join(part[0] for part in data[0] if part and part[0])
                if translated.strip():
                    return translated.strip()
    except Exception:
        pass
    return text


# ---------------------------------------------------------------- PeakCut Loudness-Only Clip Picker
def extract_loudness_db(video_path: str, sr: int = 16000) -> np.ndarray:
    """Compute per-second audio loudness in dB using ffmpeg (from PeakCut studio/live.py & media.py)."""
    cmd = [
        "ffmpeg", "-v", "error", "-i", str(video_path),
        "-vn", "-ac", "1", "-ar", str(sr), "-f", "s16le", "pipe:1",
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    db = []
    while True:
        data = proc.stdout.read(sr * 2)
        if not data:
            break
        data = data[: len(data) // 2 * 2]
        if not data:
            continue
        x = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
        level = float(20 * np.log10(np.sqrt((x ** 2).mean() + 1e-10))) if len(x) else -100.0
        db.append(level)
    proc.wait()
    return np.array(db, dtype=np.float32)


def pick_clips_by_loudness(video_path: str, max_clips: int = 5, min_len: float = 15.0, max_len: float = 45.0) -> list:
    """Fallback clip picker using audio loudness z-score (from PeakCut brain.fallback_by_loudness)."""
    db = extract_loudness_db(video_path)
    duration = float(len(db))
    if duration < min_len:
        return []
    z = (db - np.median(db)) / (db.std() + 1e-6) if len(db) >= 5 else np.zeros(len(db))
    picks = []
    order = np.argsort(-z)
    clip_len = min(max_len, max(min_len, 30.0))
    for sec in order:
        s = max(0.0, float(sec) - clip_len * 0.5)
        e = min(duration, s + clip_len)
        if e - s < min_len:
            s = max(0.0, e - min_len)
        if any(not (e <= p["start"] or s >= p["end"]) for p in picks):
            continue
        score = int(min(98, max(55, 65 + float(z[sec]) * 10)))
        picks.append({
            "start": round(s, 2),
            "end": round(e, 2),
            "score": score,
            "category": "highlight",
            "hook": "WAIT FOR THIS MOMENT",
            "title": f"High-Energy Highlight ({int(s // 60)}:{int(s % 60):02d})",
            "description": "Selected automatically from peak audio reaction energy.",
            "hashtags": ["shorts", "highlights", "viral", "clips"],
            "reason": f"Audio reaction peak (z={z[sec]:+.1f}σ)",
        })
        if len(picks) >= max_clips:
            break
    picks.sort(key=lambda c: c["start"])
    return picks
