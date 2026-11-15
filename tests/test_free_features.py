import numpy as np
from fastapi.testclient import TestClient

import ai_hub
import app
import capcut_studio
import roman
import saasshorts
import translate


def test_roman_transliteration():
    # Hindi Devanagari to Hinglish
    assert roman.has_indic_or_urdu("नमस्ते")
    assert not roman.has_indic_or_urdu("hello world")
    res = roman.to_roman("नमस्ते")
    assert res and res.isascii()

    # Word list helper
    words = [{"word": "नमस्ते", "start": 0.0, "end": 0.5}]
    out = roman.romanize_words(words)
    assert len(out) == 1
    assert out[0]["word"].isascii()


def test_ai_hub_providers_and_offline_loudness(monkeypatch):
    assert "gemini" in ai_hub.PROVIDERS
    assert "ollama" in ai_hub.PROVIDERS
    assert "loudness" in ai_hub.PROVIDERS
    assert len(ai_hub.PROVIDERS) >= 9

    # Offline loudness clip picker (PeakCut port)
    fake_db = np.array([-30.0] * 40 + [-5.0, -3.0, -4.0] + [-30.0] * 40, dtype=np.float32)
    monkeypatch.setattr(ai_hub, "extract_loudness_db", lambda _path, sr=16000: fake_db)
    clips = ai_hub.pick_clips_by_loudness("dummy.mp4", max_clips=2, min_len=15.0, max_len=30.0)
    assert len(clips) >= 1
    assert "start" in clips[0] and "end" in clips[0]
    assert clips[0]["score"] >= 55


def test_translate_languages_and_voices():
    langs = translate.get_supported_languages()
    assert "es" in langs
    assert "en" in langs
    assert "hi" in langs
    assert len(langs) >= 25
    assert "es" in translate.EDGE_NEURAL_VOICES
    assert "Neural" in translate.EDGE_NEURAL_VOICES["es"][0]


def test_saasshorts_free_voices():
    voices = saasshorts.get_elevenlabs_voices()
    assert len(voices) >= 6
    assert all(v.get("category") == "free-neural" for v in voices)


def test_fastapi_free_endpoints():
    client = TestClient(app.app)

    r_cfg = client.get("/api/config")
    assert r_cfg.status_code == 200
    data = r_cfg.json()
    assert data.get("billingEnabled") is False

    r_langs = client.get("/api/languages")
    assert r_langs.status_code == 200
    assert "es" in r_langs.json().get("languages", {})

    r_ai = client.get("/api/ai/settings")
    assert r_ai.status_code == 200
    assert "providers" in r_ai.json()

    r_voices = client.get("/api/saasshorts/voices")
    assert r_voices.status_code == 200
    assert len(r_voices.json().get("voices", [])) >= 6

    r_hist = client.get("/api/history")
    assert r_hist.status_code == 200
    assert "projects" in r_hist.json()

    r_creators = client.get("/api/creators")
    assert r_creators.status_code == 200
    assert "creators" in r_creators.json()

    # CapCut Studio catalog & royalty-free audio synthesizer endpoints
    r_studio = client.get("/api/studio/catalog")
    assert r_studio.status_code == 200
    cat = r_studio.json()
    assert len(cat.get("filters", [])) >= 15
    assert len(cat.get("effects", [])) >= 10
    assert len(cat.get("transitions", [])) >= 10
    assert len(cat.get("speed_curves", [])) >= 6
    assert len(cat.get("voice_effects", [])) >= 8
    assert len(cat.get("tts_characters", [])) >= 6
    assert len(cat.get("music_library", [])) >= 5
    assert len(cat.get("sfx_library", [])) >= 8
    assert len(cat.get("templates", [])) >= 6

    r_sfx = client.get("/api/studio/audio/sfx/vine_boom")
    assert r_sfx.status_code == 200
    assert len(r_sfx.content) > 1000

