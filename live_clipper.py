"""Live Stream Recorder, Real-Time Clipper, Creator Workspaces & Free Channel Autopilot.

Ported from PeakCut (`studio/live.py` and `studio/creators.py`):
- Creator Workspaces: manage YouTube, Twitch, and Kick channels, clip length/style preferences,
  trigger words ("clip that", "clip it"), and activity logs.
- Free Channel Autopilot: fetch the latest videos or past broadcasts from any YouTube, Twitch,
  or Kick channel URL via `yt-dlp` and clip them with zero paid subscription gates.
- Live Stream Recording & Real-Time Clipping: record a live YouTube, Twitch, or Kick stream
  into a rolling segment buffer, monitor live audio loudness spikes (+dB) and Twitch IRC chat
  activity spikes, and cut vertical 9:16 clips while the stream is still live (or on-demand via
  "Clip Last 30s / 60s").
"""

import collections
import json
import os
import re
import shutil
import socket
import ssl
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

DATA_DIR = Path(os.environ.get("CLARITY_DATA_DIR") or "outputs")
CREATORS_FILE = DATA_DIR / "creators.json"
AUTOPILOT_FILE = DATA_DIR / "autopilot_state.json"

_lock = threading.RLock()
LIVE_SESSIONS: Dict[str, "LiveSession"] = {}
SR = 16000
SEG_SEC = 6

CREATOR_DEFAULTS = {
    "name": "",
    "channel": "",
    "style": "karaoke",
    "layout": "auto",
    "min_len": 15,
    "max_len": 60,
    "max_clips": 6,
    "min_score": 75,
    "auto_watch": False,
    "buffer_min": 20,
    "live_per_hour": 4,
    "ai_every_min": 3,
    "auto_jump_pct": 60,
    "trigger_words": "clip that, clip it",
    "channels": {},
    "log": [],
}


def _platform_of(url: str) -> str:
    u = (url or "").lower()
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if "twitch.tv" in u:
        return "twitch"
    if "kick.com" in u:
        return "kick"
    return "youtube"


def normalize_channel_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    if not re.match(r"^https?://", url):
        if url.startswith("@"):
            url = f"https://www.youtube.com/{url}"
        else:
            url = "https://" + url
    return url


def normalize_live_url(url: str) -> str:
    url = normalize_channel_url(url)
    m = re.match(
        r"^(https?://(?:www\.)?youtube\.com/(?:@[^/?#]+|channel/[^/?#]+|c/[^/?#]+))/?(?:[?#].*)?$",
        url,
    )
    return m.group(1) + "/live" if m else url


# ═══════════════════════════════════════════════════════════════════════
# Creator Workspaces (from PeakCut studio/creators.py)
# ═══════════════════════════════════════════════════════════════════════

def list_creators() -> List[dict]:
    with _lock:
        if not CREATORS_FILE.exists():
            return []
        try:
            data = json.loads(CREATORS_FILE.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
        except Exception:
            return []


def _save_creators(items: List[dict]):
    with _lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        CREATORS_FILE.write_text(json.dumps(items, indent=2), encoding="utf-8")


def get_creator(cid: str) -> Optional[dict]:
    for c in list_creators():
        if c.get("id") == cid:
            return c
    return None


def create_creator(data: dict) -> dict:
    name = str(data.get("name") or "").strip()
    if not name:
        raise ValueError("Give the creator workspace a name.")
    channel = normalize_channel_url(str(data.get("channel") or ""))
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "creator"
    items = list_creators()
    existing_ids = {c.get("id") for c in items}
    cid, n = slug, 2
    while cid in existing_ids:
        cid, n = f"{slug}-{n}", n + 1

    creator = {
        **CREATOR_DEFAULTS,
        "id": cid,
        "name": name,
        "channel": channel,
        "platform": _platform_of(channel),
        "min_len": int(data.get("min_len", 15)),
        "max_len": int(data.get("max_len", 60)),
        "max_clips": int(data.get("max_clips", 6)),
        "trigger_words": str(data.get("trigger_words") or "clip that, clip it"),
        "auto_watch": bool(data.get("auto_watch", False)),
        "created_at": time.time(),
        "log": [{"t": time.time(), "msg": f"Workspace created for {name}"}],
    }
    items.append(creator)
    _save_creators(items)
    return creator


def update_creator(cid: str, patch: dict) -> dict:
    items = list_creators()
    for i, c in enumerate(items):
        if c.get("id") == cid:
            for k in ("name", "channel", "style", "layout", "min_len", "max_len", "max_clips", "trigger_words", "auto_watch", "live_per_hour", "ai_every_min"):
                if k in patch:
                    c[k] = patch[k]
            if "channel" in patch:
                c["channel"] = normalize_channel_url(c["channel"])
                c["platform"] = _platform_of(c["channel"])
            items[i] = c
            _save_creators(items)
            return c
    raise KeyError(cid)


def delete_creator(cid: str):
    items = [c for c in list_creators() if c.get("id") != cid]
    _save_creators(items)


def log_creator(cid: str, msg: str):
    if not cid:
        return
    items = list_creators()
    for c in items:
        if c.get("id") == cid:
            logs = c.get("log") or []
            logs.insert(0, {"t": time.time(), "msg": msg})
            c["log"] = logs[:50]
            _save_creators(items)
            return


# ═══════════════════════════════════════════════════════════════════════
# Free Channel Autopilot (YouTube / Twitch / Kick via yt-dlp)
# ═══════════════════════════════════════════════════════════════════════

def get_autopilot_state() -> dict:
    default_state = {
        "settings": {
            "enabled": False,
            "channel_url": "",
            "channel_name": "",
            "max_minutes": 30,
            "autopublish": False,
            "publish_platforms": [],
            "clips_to_publish": 3,
            "publish_hour": 17,
            "timezone": "UTC",
            "last_checked_at": None,
            "last_error": None,
        },
        "runs": [],
    }
    with _lock:
        if AUTOPILOT_FILE.exists():
            try:
                loaded = json.loads(AUTOPILOT_FILE.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    default_state["settings"].update(loaded.get("settings") or {})
                    default_state["runs"] = loaded.get("runs") or []
            except Exception:
                pass
    s = default_state["settings"]
    ch_url = s.get("channel_url") or ""
    plat = _platform_of(ch_url) if ch_url else None
    return {
        "eligible": True,
        "youtube": {"handle": ch_url, "display_name": s.get("channel_name") or ch_url} if ch_url and plat != "twitch" else None,
        "twitch": {"handle": ch_url, "display_name": s.get("channel_name") or ch_url} if ch_url and plat == "twitch" else None,
        "twitch_available": True,
        "accounts": {"tiktok": True, "instagram": True, "youtube": True},
        "limits": {
            "max_minutes_choices": [10, 20, 30, 45, 60, 90, 120],
            "max_clips_to_publish": 5,
            "platforms": ["tiktok", "instagram", "youtube"],
            "daily_auto": 5,
        },
        "settings": s,
        "runs": default_state["runs"],
    }


def save_autopilot_settings(patch: dict) -> dict:
    state = get_autopilot_state()
    s = state["settings"]
    for k in (
        "enabled", "channel_url", "channel_name", "max_minutes",
        "autopublish", "publish_platforms", "clips_to_publish",
        "publish_hour", "timezone", "last_checked_at", "last_error",
    ):
        if k in patch:
            s[k] = patch[k]
    if "channel_url" in patch:
        s["channel_url"] = normalize_channel_url(patch["channel_url"])
        if s["channel_url"] and not patch.get("channel_name"):
            s["channel_name"] = s["channel_url"].rstrip("/").split("/")[-1]
    with _lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        AUTOPILOT_FILE.write_text(
            json.dumps({"settings": s, "runs": state["runs"]}, indent=2),
            encoding="utf-8",
        )
    return get_autopilot_state()


def record_autopilot_run(run_entry: dict):
    state = get_autopilot_state()
    runs = [r for r in state["runs"] if r.get("video_id") != run_entry.get("video_id")]
    runs.insert(0, run_entry)
    with _lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        AUTOPILOT_FILE.write_text(
            json.dumps({"settings": state["settings"], "runs": runs[:50]}, indent=2),
            encoding="utf-8",
        )


def fetch_channel_videos(channel_url: str = "", limit: int = 10) -> List[dict]:
    """Fetch recent videos from any YouTube, Twitch, or Kick channel via yt-dlp."""
    state = get_autopilot_state()
    url = normalize_channel_url(channel_url or state["settings"].get("channel_url") or "")
    if not url:
        return []

    if "youtube.com/" in url and not url.endswith("/videos") and "/watch" not in url:
        target_url = url.rstrip("/") + "/videos"
    else:
        target_url = url

    runs_by_vid = {r.get("video_id"): r for r in state.get("runs", [])}
    videos = []
    try:
        import yt_dlp
        opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": True,
            "playlistend": limit,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(target_url, download=False)
        entries = info.get("entries") if isinstance(info, dict) and "entries" in info else ([info] if info else [])
        for entry in (entries or [])[:limit]:
            if not entry:
                continue
            vid_id = str(entry.get("id") or "")
            vid_url = entry.get("url") or entry.get("webpage_url") or ""
            if vid_id and not vid_url.startswith("http"):
                if "twitch" in url:
                    vid_url = f"https://www.twitch.tv/videos/{vid_id}"
                else:
                    vid_url = f"https://www.youtube.com/watch?v={vid_id}"
            thumbs = entry.get("thumbnails") or []
            thumb = entry.get("thumbnail") or (thumbs[-1].get("url") if thumbs else "")
            if not thumb and "youtube" in vid_url and vid_id:
                thumb = f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg"
            videos.append({
                "id": vid_id or vid_url,
                "title": entry.get("title") or vid_id,
                "url": vid_url,
                "thumbnail_url": thumb,
                "duration": entry.get("duration"),
                "is_live": bool(entry.get("is_live") or entry.get("live_status") == "is_live"),
                "source": _platform_of(url),
                "published_at": None,
                "run": runs_by_vid.get(vid_id),
            })
    except Exception as e:
        print(f"[Autopilot] Channel video fetch notice: {e}")
    return videos


# ═══════════════════════════════════════════════════════════════════════
# Live Stream Recording & Real-Time Clipping (from PeakCut studio/live.py)
# ═══════════════════════════════════════════════════════════════════════

class NotLiveError(Exception):
    pass


def resolve_live_stream(url: str) -> dict:
    """Resolve playable stream URL(s) via yt-dlp. Raises NotLiveError if offline."""
    import yt_dlp
    live_url = normalize_live_url(url)
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "format": "b[height<=720]/bv*[height<=720]+ba/b",
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(live_url, download=False)
    except Exception as e:
        raise NotLiveError(str(e)[-200:]) from e
    if not info:
        raise NotLiveError("Could not resolve stream metadata.")
    is_live = bool(info.get("is_live") or info.get("live_status") == "is_live")
    fmts = info.get("requested_formats") or [info]
    play_urls = [f["url"] for f in fmts if f.get("url")]
    if not play_urls:
        raise NotLiveError("No playable stream URL found.")
    title = info.get("title") or "Live Stream"
    uploader = info.get("uploader") or info.get("channel") or "Creator"
    return {
        "urls": play_urls,
        "title": title,
        "uploader": uploader,
        "is_live": is_live,
        "webpage_url": info.get("webpage_url") or live_url,
    }


class LiveSession:
    """Records a live stream (or broadcast) into rolling 6s MPEG-TS segments, tracks
    loudness (dB) and Twitch IRC chat spikes, and cuts vertical 9:16 clips in real time."""

    def __init__(self, session_id: str, url: str, creator_id: str = "", settings: Optional[dict] = None):
        self.id = session_id
        self.url = normalize_live_url(url)
        self.creator_id = creator_id
        self.settings = {**CREATOR_DEFAULTS, **(settings or {})}
        self.dir = DATA_DIR / f"live_{session_id}"
        self.buf = self.dir / "buffer"
        self.clips_dir = self.dir / "clips"
        self.buf.mkdir(parents=True, exist_ok=True)
        self.clips_dir.mkdir(parents=True, exist_ok=True)

        self.lock = threading.RLock()
        self.stop_flag = threading.Event()
        self.status = "connecting"
        self.stage = "Connecting to stream..."
        self.error = None
        self.title = self.url
        self.uploader = ""
        self.started_at = time.time()
        self.proc: Optional[subprocess.Popen] = None

        self.samples = 0
        self.db: List[float] = []
        self.segments: List[tuple] = []  # (Path, start_sec, end_sec)
        self.seg_clock = 0.0
        self.csv_seen: Dict[int, int] = {}
        self.part = 0

        self.chat = collections.Counter()
        self.chat_total = 0
        self.chat_on = False

        self.spikes = 0
        self.last_spike = -999.0
        self.verdicts: List[dict] = []
        self.clips: List[dict] = []
        self.manual_queue: List[dict] = []

    def start(self):
        LIVE_SESSIONS[self.id] = self
        threading.Thread(target=self._ingest_loop, daemon=True).start()
        threading.Thread(target=self._monitor_loop, daemon=True).start()
        m = re.match(r"^https?://(?:www\.)?twitch\.tv/([A-Za-z0-9_]+)", self.url)
        if m:
            threading.Thread(target=self._twitch_chat_loop, args=(m.group(1).lower(),), daemon=True).start()

    def stop(self, note: str = "Stopped by user"):
        self.stop_flag.set()
        with self.lock:
            self.status = "stopped"
            self.stage = note
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.terminate()
            except Exception:
                pass
        log_creator(self.creator_id, f"Live session stopped ({note}): {len(self.clips)} clips")

    def clip_last(self, seconds: int = 30) -> dict:
        """Manually queue a clip of the last N seconds of the stream."""
        elapsed = self.samples / SR
        if elapsed < 4:
            raise ValueError("Wait a few seconds for the stream buffer to fill first.")
        seconds = max(10, min(120, int(seconds)))
        req = {
            "start": max(0.0, elapsed - seconds),
            "end": elapsed,
            "why": f"Manual clip (last {seconds}s)",
        }
        with self.lock:
            self.manual_queue.append(req)
        return req

    def _ingest_loop(self):
        try:
            info = resolve_live_stream(self.url)
        except NotLiveError as e:
            with self.lock:
                self.status = "error"
                self.error = str(e)
                self.stage = f"Could not connect: {e}"
            return

        with self.lock:
            self.title = info["title"]
            self.uploader = info["uploader"]
            self.status = "live"
            self.stage = "Recording live stream"
        log_creator(self.creator_id, f"Started recording: {self.title}")

        self.part += 1
        p = f"p{self.part:02d}"
        cmd = [
            "ffmpeg", "-v", "error",
            "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "10",
        ]
        for u in info["urls"]:
            cmd += ["-i", u]
        a_in = "1:a:0" if len(info["urls"]) > 1 else "0:a:0"
        cmd += [
            "-map", "0:v:0", "-map", a_in,
            "-c", "copy", "-f", "segment", "-segment_time", str(SEG_SEC),
            "-reset_timestamps", "1", "-segment_format", "mpegts",
            "-segment_list", f"{p}.csv", "-segment_list_type", "csv", f"{p}_%05d.ts",
            "-map", a_in, "-vn", "-ac", "1", "-ar", str(SR), "-f", "s16le", "pipe:1",
        ]

        try:
            self.proc = subprocess.Popen(
                cmd,
                cwd=self.buf,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
            while not self.stop_flag.is_set():
                data = self.proc.stdout.read(SR * 2)
                if not data:
                    break
                data = data[: len(data) // 2 * 2]
                if not data:
                    continue
                x = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
                level = float(20 * np.log10(np.sqrt((x ** 2).mean() + 1e-10))) if len(x) else -100.0
                with self.lock:
                    self.samples += len(data) // 2
                    self.db.append(level)
            self.proc.wait()
        except Exception as e:
            with self.lock:
                self.error = str(e)
        finally:
            if self.status != "stopped" and self.status != "error":
                with self.lock:
                    self.status = "completed"
                    self.stage = "Stream ended"

    def _scan_segments(self):
        with self.lock:
            for i in range(1, self.part + 1):
                f = self.buf / f"p{i:02d}.csv"
                if not f.exists():
                    continue
                rows = [
                    r.split(",")
                    for r in f.read_text(encoding="utf-8", errors="ignore").splitlines()
                    if r.count(",") >= 2
                ]
                for name, a, b in (r[:3] for r in rows[self.csv_seen.get(i, 0) :]):
                    try:
                        dur = max(0.0, float(b) - float(a))
                    except ValueError:
                        continue
                    self.segments.append((self.buf / name, self.seg_clock, self.seg_clock + dur))
                    self.seg_clock += dur
                self.csv_seen[i] = len(rows)

            keep_from = self.seg_clock - float(self.settings.get("buffer_min", 20)) * 60
            while self.segments and self.segments[0][2] < keep_from:
                self.segments.pop(0)[0].unlink(missing_ok=True)

    def _twitch_chat_loop(self, channel: str):
        """Connect to anonymous Twitch IRC (`justinfan`) to track live chat velocity spikes."""
        while not self.stop_flag.is_set() and self.status in ("connecting", "live"):
            try:
                raw = socket.create_connection(("irc.chat.twitch.tv", 6697), timeout=15)
                s = ssl.create_default_context().wrap_socket(raw, server_hostname="irc.chat.twitch.tv")
                s.sendall(f"NICK justinfan{int(time.time()) % 80000 + 10000}\r\nJOIN #{channel}\r\n".encode())
                s.settimeout(30)
                rest = b""
                self.chat_on = True
                while not self.stop_flag.is_set():
                    try:
                        data = s.recv(8192)
                    except socket.timeout:
                        continue
                    if not data:
                        break
                    *lines, rest = (rest + data).split(b"\r\n")
                    for line in lines:
                        if line.startswith(b"PING"):
                            s.sendall(b"PONG :tmi.twitch.tv\r\n")
                        elif b" PRIVMSG #" in line:
                            with self.lock:
                                self.chat[int(self.samples / SR)] += 1
                                self.chat_total += 1
                s.close()
            except Exception:
                pass
            self.chat_on = False
            self.stop_flag.wait(5)

    def _monitor_loop(self):
        while not self.stop_flag.is_set() and self.status in ("connecting", "live"):
            self._scan_segments()
            self._check_spikes()
            self._process_manual_queue()
            time.sleep(2)
        self._scan_segments()
        self._process_manual_queue()

    def _check_spikes(self):
        with self.lock:
            n = len(self.db)
            if n < 45:
                return
            db = np.array(self.db[max(0, n - 180) :], dtype=np.float32)
            chat = (
                [self.chat.get(t, 0) for t in range(max(0, n - 180), n)]
                if (self.chat_on or self.chat_total)
                else None
            )

        amp = 10 ** (db / 20)
        base, cur = float(amp[:-8].mean()), float(amp[-5:].mean())
        loud_jump = cur / max(base, 1e-6) - 1.0
        pct = float(self.settings.get("auto_jump_pct", 60)) / 100.0
        why = []
        if loud_jump >= pct:
            why.append(f"loudness +{round(loud_jump * 100)}%")
        if chat is not None and len(chat) > 12:
            chat_base = sum(chat[:-8]) / max(1, len(chat) - 8)
            chat_now = sum(chat[-6:]) / 6
            if chat_now >= max(1.5, chat_base * (1 + pct)):
                why.append(f"chat +{round((chat_now / max(chat_base, 0.01) - 1) * 100)}%")

        if why and (n - self.last_spike) >= 60:
            self.last_spike = n
            self.spikes += 1
            reason = "Spike detected: " + ", ".join(why)
            self.verdicts.insert(0, {"t": n, "trigger": reason, "result": "Auto-clipping highlight"})
            self.verdicts = self.verdicts[:12]
            with self.lock:
                self.manual_queue.append({
                    "start": max(0.0, float(n) - 25.0),
                    "end": float(n) + 5.0,
                    "why": reason,
                })

    def _process_manual_queue(self):
        with self.lock:
            ready = [
                req for req in self.manual_queue
                if self.seg_clock >= req["end"] or self.status != "live"
            ]
            for r in ready:
                self.manual_queue.remove(r)

        for req in ready:
            self._render_live_clip(req["start"], req["end"], req.get("why", "Live highlight"))

    def _render_live_clip(self, start: float, end: float, reason: str):
        self._scan_segments()
        with self.lock:
            segs = [
                s for s in self.segments
                if s[2] > start - 4 and s[1] < end + 4 and s[0].exists()
            ]
        if not segs:
            return
        clip_idx = len(self.clips) + 1
        clip_id = f"clip_{clip_idx:03d}"
        concat_list = self.clips_dir / f"{clip_id}.txt"
        out_mp4 = self.clips_dir / f"{clip_id}.mp4"
        concat_list.write_text(
            "".join(f"file '{s[0].resolve().as_posix()}'\n" for s in segs),
            encoding="utf-8",
        )
        local_start = max(0.0, start - segs[0][1])
        dur = max(5.0, end - start)
        vf = (
            "fps=30,split=2[a][b];"
            "[a]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=8:2,scale=1080:1920[bg];"
            "[b]scale=1080:-2:force_original_aspect_ratio=decrease[fg];"
            "[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1"
        )
        cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-ss", f"{local_start:.2f}", "-t", f"{dur:.2f}",
            "-filter_complex", vf,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "160k",
            str(out_mp4),
        ]
        try:
            subprocess.run(cmd, check=True, timeout=300)
            rel_url = f"/outputs/live_{self.id}/clips/{clip_id}.mp4"
            clip_entry = {
                "id": clip_id,
                "title": f"{self.title[:40]} — Clip #{clip_idx}",
                "start": round(start, 1),
                "end": round(end, 1),
                "reason": reason,
                "video_url": rel_url,
                "download_url": rel_url,
                "created_at": time.time(),
            }
            with self.lock:
                self.clips.insert(0, clip_entry)
            log_creator(self.creator_id, f"Rendered live clip #{clip_idx} ({reason})")
        except Exception as e:
            print(f"[LiveClipper] Render error: {e}")
        finally:
            concat_list.unlink(missing_ok=True)

    def to_dict(self) -> dict:
        with self.lock:
            elapsed = round(self.samples / SR)
            return {
                "id": self.id,
                "url": self.url,
                "creator_id": self.creator_id,
                "status": self.status,
                "stage": self.stage,
                "error": self.error,
                "title": self.title,
                "uploader": self.uploader,
                "elapsed_seconds": elapsed,
                "buffer_seconds": round(self.segments[-1][2] - self.segments[0][1]) if self.segments else 0,
                "levels_db": [round(x, 1) for x in self.db[-60:]],
                "chat_counts": [self.chat.get(t, 0) for t in range(max(0, elapsed - 60), elapsed)] if (self.chat_on or self.chat_total) else None,
                "spikes_detected": self.spikes,
                "verdicts": list(self.verdicts),
                "clips": list(self.clips),
            }


def start_live_session(url: str, creator_id: str = "", settings: Optional[dict] = None) -> dict:
    sid = str(uuid.uuid4())[:8]
    sess = LiveSession(sid, url, creator_id=creator_id, settings=settings)
    sess.start()
    return sess.to_dict()


def get_live_sessions() -> List[dict]:
    return [s.to_dict() for s in LIVE_SESSIONS.values()]


def stop_live_session(session_id: str) -> Optional[dict]:
    sess = LIVE_SESSIONS.get(session_id)
    if not sess:
        return None
    sess.stop()
    return sess.to_dict()


def trigger_live_clip(session_id: str, seconds: int = 30) -> dict:
    sess = LIVE_SESSIONS.get(session_id)
    if not sess:
        raise KeyError(session_id)
    req = sess.clip_last(seconds)
    return {"queued": True, "request": req, "session": sess.to_dict()}
