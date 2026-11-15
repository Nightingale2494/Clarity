import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Scissors, Sparkles, Sliders, Type, Music, Wand2, Play, Pause, RotateCcw,
  RotateCw, FlipHorizontal, FlipVertical, Plus, Trash2, Copy, Merge,
  Volume2, Upload, Download, Check, Loader2, Film, Layers, Zap, Eye,
  Maximize2, Flag, Activity, RefreshCw, AlertCircle, Video
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { getApiUrl } from '../config';

const DEFAULT_RECIPE = {
  segments: [{ start: 0, end: 30, speed: 1.0, label: 'Segment 1' }],
  markers: [],
  speed: 1.0,
  speed_curve: 'constant',
  optical_flow: false,
  reverse: false,
  freeze_at: null,
  freeze_duration: 0,
  mirror_h: false,
  mirror_v: false,
  rotate: 0,
  crop_aspect: 'original',
  scale: 1.0,
  auto_zoom_keyframes: false,
  keyframes: [],
  filter: 'none',
  color: {
    brightness: 0,
    contrast: 1.0,
    saturation: 1.0,
    hue: 0,
    warmth: 0,
    tint: 0,
    sharpness: 0,
    vignette: false,
  },
  effect: 'none',
  transition: 'none',
  mask: 'none',
  chroma_key: {
    enabled: false,
    color: '#00FF00',
    similarity: 0.25,
    blend: 0.10,
  },
  text_layers: [],
  stickers: [],
  noise_removal: false,
  voice_isolation: false,
  voice_enhance: false,
  voice_effect: 'none',
  music: '',
  music_volume: 0.22,
  sfx: '',
  sfx_volume: 0.75,
  sfx_time: 0.2,
  tts_filename: '',
  tts_time: 0.0,
  remove_silence: false,
};

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00.0';
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

export default function CapCutStudioTab({ initialClip = null, onClipUpdated = null }) {
  const [catalog, setCatalog] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeClip, setActiveClip] = useState(initialClip);
  const [videoDuration, setVideoDuration] = useState(30);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePanel, setActivePanel] = useState('timeline'); // timeline | effects | text | audio | ai

  // Undo / Redo recipe state
  const [recipe, setRecipeState] = useState(DEFAULT_RECIPE);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [selectedSegIdx, setSelectedSegIdx] = useState(0);

  // Beat detection & silence & AI states
  const [beatsData, setBeatsData] = useState(null);
  const [silenceData, setSilenceData] = useState(null);
  const [pilotSummary, setPilotSummary] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Text & TTS inputs
  const [newText, setNewText] = useState('WAIT FOR THIS 🔥');
  const [newTextColor, setNewTextColor] = useState('#FFFFFF');
  const [newTextBg, setNewTextBg] = useState('#EF4444');
  const [newTextY, setNewTextY] = useState(15);
  const [ttsText, setTtsText] = useState('');
  const [ttsChar, setTtsChar] = useState('ava_creator');
  const [ttsResult, setTtsResult] = useState(null);

  // AI BG Removal & Upscale states
  const [bgMode, setBgMode] = useState('blur');
  const [bgColor, setBgColor] = useState('#10B981');
  const [upscaleRes, setUpscaleRes] = useState('1080p');
  const [upscale60fps, setUpscale60fps] = useState(false);

  const videoRef = useRef(null);
  const audioPreviewRef = useRef(null);

  const updateRecipe = (updater) => {
    setRecipeState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      setHistory((h) => ({ past: [...h.past.slice(-25), prev], future: [] }));
      return next;
    });
  };

  const handleUndo = () => {
    if (!history.past.length) return;
    const previous = history.past[history.past.length - 1];
    setHistory((h) => ({
      past: h.past.slice(0, -1),
      future: [recipe, ...h.future],
    }));
    setRecipeState(previous);
  };

  const handleRedo = () => {
    if (!history.future.length) return;
    const next = history.future[0];
    setHistory((h) => ({
      past: [...h.past, recipe],
      future: h.future.slice(1),
    }));
    setRecipeState(next);
  };

  useEffect(() => {
    apiFetch('/api/studio/catalog')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCatalog(d))
      .catch(() => {});

    apiFetch('/api/history')
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d) => {
        const list = d.projects || [];
        setProjects(list);
        if (!activeClip && list.length > 0 && list[0].clips?.length > 0) {
          const first = list[0].clips[0];
          setActiveClip({
            jobId: list[0].job_id,
            clipIndex: first.index ?? 0,
            title: first.title || list[0].video_title || 'Clip 1',
            video_url: first.video_url,
            filename: first.filename,
            duration: (first.end || 30) - (first.start || 0),
          });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialClip) {
      setActiveClip(initialClip);
    }
  }, [initialClip]);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    const dur = Number(v.duration.toFixed(2));
    setVideoDuration(dur);
    setRecipeState((prev) => ({
      ...prev,
      segments: [{ start: 0, end: dur, speed: 1.0, label: 'Segment 1' }],
    }));
  };

  // Live CSS filter preview for instant feedback before FFmpeg render
  const liveCssFilter = useMemo(() => {
    const c = recipe.color || {};
    const b = 1 + (c.brightness || 0);
    const contrast = c.contrast ?? 1;
    const sat = c.saturation ?? 1;
    const hue = c.hue || 0;
    const parts = [
      `brightness(${b})`,
      `contrast(${contrast})`,
      `saturate(${sat})`,
      `hue-rotate(${hue}deg)`,
    ];
    if (recipe.filter === 'crisp_bw') parts.push('grayscale(1) contrast(1.25)');
    if (recipe.filter === 'sepia_classic') parts.push('sepia(0.85)');
    if (recipe.filter === 'cyberpunk') parts.push('saturate(1.4) contrast(1.15) hue-rotate(-12deg)');
    if (recipe.filter === 'teal_orange') parts.push('contrast(1.1) saturate(1.22)');
    if (recipe.filter === 'warm_sunset') parts.push('sepia(0.22) saturate(1.25)');
    if (recipe.filter === 'moody_matte') parts.push('saturate(0.75) contrast(1.08)');
    return parts.join(' ');
  }, [recipe.color, recipe.filter]);

  const liveTransform = useMemo(() => {
    const parts = [];
    if (recipe.mirror_h) parts.push('scaleX(-1)');
    if (recipe.mirror_v) parts.push('scaleY(-1)');
    if (recipe.rotate) parts.push(`rotate(${recipe.rotate}deg)`);
    if (recipe.scale && recipe.scale !== 1) parts.push(`scale(${recipe.scale})`);
    return parts.join(' ');
  }, [recipe.mirror_h, recipe.mirror_v, recipe.rotate, recipe.scale]);

  // ── Timeline Tools: Split, Trim, Merge, Duplicate, Delete, Markers ──
  const handleSplitAtPlayhead = () => {
    const t = Number(playhead.toFixed(2));
    const idx = recipe.segments.findIndex((s) => t > s.start + 0.3 && t < s.end - 0.3);
    if (idx === -1) {
      setStatusMsg('Move playhead inside a segment (at least 0.3s from edges) to split.');
      return;
    }
    const seg = recipe.segments[idx];
    const left = { ...seg, end: t, label: `${seg.label || 'Seg'} A` };
    const right = { ...seg, start: t, label: `${seg.label || 'Seg'} B` };
    const nextSegs = [...recipe.segments.slice(0, idx), left, right, ...recipe.segments.slice(idx + 1)];
    updateRecipe({ segments: nextSegs });
    setSelectedSegIdx(idx + 1);
    setStatusMsg(`Split segment at ${fmtTime(t)}`);
  };

  const handleDuplicateSegment = () => {
    const seg = recipe.segments[selectedSegIdx];
    if (!seg) return;
    const copy = { ...seg, label: `${seg.label || 'Segment'} (Copy)` };
    const nextSegs = [
      ...recipe.segments.slice(0, selectedSegIdx + 1),
      copy,
      ...recipe.segments.slice(selectedSegIdx + 1),
    ];
    updateRecipe({ segments: nextSegs });
    setStatusMsg('Duplicated selected segment');
  };

  const handleDeleteSegment = () => {
    if (recipe.segments.length <= 1) {
      setStatusMsg('Cannot delete the only segment on the timeline.');
      return;
    }
    const nextSegs = recipe.segments.filter((_, i) => i !== selectedSegIdx);
    updateRecipe({ segments: nextSegs });
    setSelectedSegIdx(Math.max(0, selectedSegIdx - 1));
    setStatusMsg('Deleted segment');
  };

  const handleMergeSegments = () => {
    if (recipe.segments.length < 2) return;
    const idx = Math.min(selectedSegIdx, recipe.segments.length - 2);
    const a = recipe.segments[idx];
    const b = recipe.segments[idx + 1];
    const merged = {
      start: Math.min(a.start, b.start),
      end: Math.max(a.end, b.end),
      speed: a.speed || 1.0,
      label: a.label || 'Merged Segment',
    };
    const nextSegs = [...recipe.segments.slice(0, idx), merged, ...recipe.segments.slice(idx + 2)];
    updateRecipe({ segments: nextSegs });
    setSelectedSegIdx(idx);
    setStatusMsg('Merged adjacent segments');
  };

  const handleAddMarker = () => {
    const t = Number(playhead.toFixed(2));
    const nextMarkers = [...(recipe.markers || []), { time: t, label: `Marker ${(recipe.markers?.length || 0) + 1}` }];
    updateRecipe({ markers: nextMarkers });
    setStatusMsg(`Added timeline marker at ${fmtTime(t)}`);
  };

  const handleAddKeyframe = () => {
    const t = Number(playhead.toFixed(2));
    const kf = { time: t, scale: recipe.scale || 1.15, x: 0, y: 0, rotation: recipe.rotate || 0 };
    const nextKf = [...(recipe.keyframes || []).filter((k) => Math.abs(k.time - t) > 0.2), kf].sort((a, b) => a.time - b.time);
    updateRecipe({ keyframes: nextKf, auto_zoom_keyframes: true });
    setStatusMsg(`Placed transform keyframe at ${fmtTime(t)} (${kf.scale.toFixed(2)}x zoom)`);
  };

  // ── Upload Standalone Video into CapCut Studio ──
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusyAction('upload');
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch('/api/studio/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setActiveClip({
        jobId: data.job_id,
        clipIndex: data.clip_index,
        title: data.clip.title,
        video_url: data.video_url,
        filename: data.clip.filename,
        duration: data.duration,
      });
      setStatusMsg(`Loaded "${data.clip.title}" (${data.duration}s) into CapCut Studio`);
    } catch (err) {
      setErrorMsg(`Upload failed: ${err.message}`);
    } finally {
      setBusyAction('');
    }
  };

  // ── Backend Smart Actions (Beats, Silence, Auto-Color, TTS, BG Removal, Upscale, Edit Pilot, Render) ──
  const handleDetectBeats = async () => {
    if (!activeClip) return;
    setBusyAction('beats');
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/studio/detect-beats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: activeClip.jobId,
          clip_index: activeClip.clipIndex || 0,
          input_filename: activeClip.filename,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setBeatsData(data);
      const beatMarkers = (data.beats || []).slice(0, 40).map((b, i) => ({
        time: b.time,
        label: b.is_downbeat ? `Beat ${i + 1} (Downbeat)` : `Beat ${i + 1}`,
        isBeat: true,
      }));
      updateRecipe({ markers: beatMarkers });
      setStatusMsg(`Detected ${data.count} musical beats at ${data.bpm} BPM!`);
    } catch (err) {
      setErrorMsg(`Beat detection failed: ${err.message}`);
    } finally {
      setBusyAction('');
    }
  };

  const handleSnapCutsToBeats = () => {
    if (!beatsData?.beats?.length) return;
    const downbeats = beatsData.beats.filter((b) => b.is_downbeat && b.time > 0.8 && b.time < videoDuration - 0.8);
    if (!downbeats.length) return;
    const cuts = [0, ...downbeats.slice(0, 8).map((b) => b.time), videoDuration];
    const segs = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      if (cuts[i + 1] - cuts[i] >= 0.4) {
        segs.push({ start: Number(cuts[i].toFixed(2)), end: Number(cuts[i + 1].toFixed(2)), speed: 1.0, label: `Beat Seg ${i + 1}` });
      }
    }
    if (segs.length) {
      updateRecipe({ segments: segs });
      setStatusMsg(`Snapped ${segs.length} timeline segments to musical downbeats!`);
    }
  };

  const handleRemoveSilence = async () => {
    if (!activeClip) return;
    setBusyAction('silence');
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/studio/remove-silence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: activeClip.jobId,
          clip_index: activeClip.clipIndex || 0,
          input_filename: activeClip.filename,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSilenceData(data);
      if (data.segments?.length) {
        updateRecipe({
          segments: data.segments.map((s, idx) => ({ ...s, speed: 1.0, label: `Talk ${idx + 1}` })),
          remove_silence: true,
        });
      }
      setStatusMsg(`Found ${data.silences_found} silent pauses — removed ${data.removed_seconds}s of dead air!`);
    } catch (err) {
      setErrorMsg(`Silence detection failed: ${err.message}`);
    } finally {
      setBusyAction('');
    }
  };

  const handleAutoColor = async () => {
    if (!activeClip) return;
    setBusyAction('autocolor');
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/studio/auto-color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: activeClip.jobId,
          clip_index: activeClip.clipIndex || 0,
          input_filename: activeClip.filename,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      updateRecipe((prev) => ({
        ...prev,
        color: {
          ...prev.color,
          brightness: data.brightness,
          contrast: data.contrast,
          saturation: data.saturation,
          warmth: data.warmth,
          tint: data.tint,
          sharpness: data.sharpness,
        },
      }));
      setStatusMsg(`Auto Color Graded: contrast ${data.contrast}x, saturation ${data.saturation}x, warmth ${data.warmth > 0 ? '+' : ''}${data.warmth}`);
    } catch (err) {
      setErrorMsg(`Auto color failed: ${err.message}`);
    } finally {
      setBusyAction('');
    }
  };

  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) return;
    setBusyAction('tts');
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/studio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsText.trim(), character_id: ttsChar }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTtsResult(data);
      updateRecipe({ tts_filename: data.filename, tts_time: Number(playhead.toFixed(2)) });
      setStatusMsg(`Added "${data.character}" voiceover (${data.duration}s) at ${fmtTime(playhead)}`);
    } catch (err) {
      setErrorMsg(`TTS failed: ${err.message}`);
    } finally {
      setBusyAction('');
    }
  };

  const handleRemoveBackground = async () => {
    if (!activeClip) return;
    setBusyAction('removebg');
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/studio/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: activeClip.jobId,
          clip_index: activeClip.clipIndex || 0,
          input_filename: activeClip.filename,
          bg_mode: bgMode,
          bg_color: bgColor,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const updated = { ...activeClip, video_url: data.video_url, filename: data.filename };
      setActiveClip(updated);
      if (onClipUpdated) onClipUpdated(updated);
      setStatusMsg('AI Background Removal applied successfully!');
    } catch (err) {
      setErrorMsg(`Background removal failed: ${err.message}`);
    } finally {
      setBusyAction('');
    }
  };

  const handleUpscaleVideo = async () => {
    if (!activeClip) return;
    setBusyAction('upscale');
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/studio/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: activeClip.jobId,
          clip_index: activeClip.clipIndex || 0,
          input_filename: activeClip.filename,
          target_res: upscaleRes,
          denoise: true,
          sharpen: 0.8,
          interpolate_60fps: upscale60fps,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const updated = { ...activeClip, video_url: data.video_url, filename: data.filename };
      setActiveClip(updated);
      if (onClipUpdated) onClipUpdated(updated);
      setStatusMsg(`Upscaled & enhanced video to ${upscaleRes.toUpperCase()}${upscale60fps ? ' @ 60fps' : ''}!`);
    } catch (err) {
      setErrorMsg(`Upscale failed: ${err.message}`);
    } finally {
      setBusyAction('');
    }
  };

  const handleRunEditPilot = async () => {
    if (!activeClip) return;
    setBusyAction('pilot');
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/studio/edit-pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: activeClip.jobId,
          clip_index: activeClip.clipIndex || 0,
          input_filename: activeClip.filename,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPilotSummary(data.summary || '');
      if (data.beats) setBeatsData(data.beats);
      if (data.silence_analysis) setSilenceData(data.silence_analysis);
      updateRecipe((prev) => ({
        ...prev,
        filter: data.filter || prev.filter,
        effect: data.effect || prev.effect,
        music: data.music || prev.music,
        sfx: data.sfx || prev.sfx,
        auto_zoom_keyframes: true,
        voice_enhance: true,
        color: {
          ...prev.color,
          ...(data.auto_color || {}),
        },
        text_layers: [
          ...(prev.text_layers || []),
          {
            text: data.hook_text || 'WAIT FOR IT 🔥',
            color: '#FFFFFF',
            bg: '#EF4444',
            size: 58,
            x_pct: 50,
            y_pct: 14,
          },
        ],
      }));
      setStatusMsg('AI Edit Pilot configured color grading, dynamic zoom keyframes, hook banner, and audio!');
    } catch (err) {
      setErrorMsg(`Edit Pilot failed: ${err.message}`);
    } finally {
      setBusyAction('');
    }
  };

  const handleApplyTemplate = (tpl) => {
    const s = tpl.settings || {};
    updateRecipe((prev) => ({
      ...prev,
      filter: s.filter || 'none',
      effect: s.effect || 'none',
      transition: s.transition || 'none',
      speed_curve: s.speed_curve || 'constant',
      speed: s.speed || 1.0,
      optical_flow: !!s.optical_flow,
      voice_enhance: !!s.voice_enhance,
      voice_effect: s.voice_effect || 'none',
      auto_zoom_keyframes: !!s.auto_zoom_keyframes,
      music: s.music || '',
      sfx: s.sfx || '',
      text_layers: s.text_overlay
        ? [{ text: s.text_overlay.text, color: s.text_overlay.color, bg: s.text_overlay.bg, size: 58, x_pct: 50, y_pct: s.text_overlay.y_pct || 14 }]
        : prev.text_layers,
    }));
    setStatusMsg(`Applied template: "${tpl.name}"`);
  };

  const handleRenderProject = async () => {
    if (!activeClip) return;
    setBusyAction('render');
    setErrorMsg('');
    setStatusMsg('Rendering multi-layer CapCut Studio timeline with FFmpeg...');
    try {
      const res = await apiFetch('/api/studio/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: activeClip.jobId,
          clip_index: activeClip.clipIndex || 0,
          input_filename: activeClip.filename,
          recipe,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const updated = { ...activeClip, video_url: data.video_url, filename: data.filename };
      setActiveClip(updated);
      if (onClipUpdated) onClipUpdated(updated);
      setStatusMsg(`Rendered CapCut Studio video in ${data.render_seconds}s!`);
    } catch (err) {
      setErrorMsg(`Render failed: ${err.message}`);
    } finally {
      setBusyAction('');
    }
  };

  const previewAudioAsset = (kind, id) => {
    if (!audioPreviewRef.current) return;
    audioPreviewRef.current.src = getApiUrl(`/api/studio/audio/${kind}/${id}`);
    audioPreviewRef.current.play().catch(() => {});
  };

  return (
    <div className="space-y-5">
      <audio ref={audioPreviewRef} className="hidden" />

      {/* Header Bar */}
      <div className="bg-paper2 border border-rule rounded-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider bg-brass/20 text-brass rounded">
              CapCut Pro Studio — 100% Free
            </span>
            <h2 className="text-lg font-semibold text-ink">
              Multi-Layer Timeline, Speed Curves, Optical Flow, VFX, Masks, Audio & AI Tools
            </h2>
          </div>
          <p className="text-xs text-ink3 mt-0.5">
            Every CapCut Pro feature running locally via FFmpeg, Whisper, Edge Neural TTS & Clarity AI Hub ($0.00 cost).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Clip selector from local projects */}
          <select
            className="bg-paper3 border border-rule rounded-input px-2.5 py-1.5 text-xs text-ink"
            value={activeClip ? `${activeClip.jobId}::${activeClip.clipIndex || 0}` : ''}
            onChange={(e) => {
              const [jid, cidx] = e.target.value.split('::');
              const proj = projects.find((p) => p.job_id === jid);
              const cl = proj?.clips?.[Number(cidx)];
              if (proj && cl) {
                setActiveClip({
                  jobId: proj.job_id,
                  clipIndex: Number(cidx),
                  title: cl.title || proj.video_title,
                  video_url: cl.video_url,
                  filename: cl.filename,
                });
              }
            }}
          >
            <option value="">Select a clip from History...</option>
            {projects.map((p) =>
              (p.clips || []).map((c, idx) => (
                <option key={`${p.job_id}-${idx}`} value={`${p.job_id}::${idx}`}>
                  {(p.video_title || p.job_id).slice(0, 28)} — Clip #{idx + 1}
                </option>
              ))
            )}
          </select>

          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-paper3 hover:bg-paper border border-rule text-xs text-ink2">
            <Upload size={13} />
            <span>Upload Video</span>
            <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
          </label>

          <button
            onClick={handleUndo}
            disabled={!history.past.length}
            className="px-2.5 py-1.5 rounded-input border border-rule bg-paper3 text-xs text-ink2 disabled:opacity-40"
            title="Undo"
          >
            <RotateCcw size={13} />
          </button>
          <button
            onClick={handleRedo}
            disabled={!history.future.length}
            className="px-2.5 py-1.5 rounded-input border border-rule bg-paper3 text-xs text-ink2 disabled:opacity-40"
            title="Redo"
          >
            <RotateCw size={13} />
          </button>

          <button
            onClick={handleRenderProject}
            disabled={!activeClip || !!busyAction}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-input bg-brass text-paper font-medium text-xs hover:opacity-95 disabled:opacity-50"
          >
            {busyAction === 'render' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>Render Studio Video</span>
          </button>
        </div>
      </div>

      {/* Status / Error Banner */}
      {(statusMsg || errorMsg) && (
        <div
          className={`px-3.5 py-2 rounded-input border text-xs flex items-center justify-between ${
            errorMsg ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <span>{errorMsg || statusMsg}</span>
          <button onClick={() => { setStatusMsg(''); setErrorMsg(''); }} className="text-[11px] underline ml-4">
            dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Grid: Left Tool Tabs + Center Video Monitor + Right Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Category Navigation */}
        <div className="lg:col-span-2 flex lg:flex-col gap-1.5 overflow-x-auto">
          {[
            { id: 'timeline', label: '1. Timeline & Speed', icon: <Scissors size={15} />, sub: 'Split, Beats, Curves, Keyframes' },
            { id: 'effects', label: '2. Filters, VFX & Masks', icon: <Sliders size={15} />, sub: 'HSL, LUTs, Glitch, Chroma Key' },
            { id: 'text', label: '3. Text, Stickers & TTS', icon: <Type size={15} />, sub: 'Titles, Emojis, AI Voiceover' },
            { id: 'audio', label: '4. Music, SFX & Voice', icon: <Music size={15} />, sub: 'Royalty-Free Beats, Denoise, FX' },
            { id: 'ai', label: '5. AI Tools & Templates', icon: <Wand2 size={15} />, sub: 'Edit Pilot, BG Remove, Upscale' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
              className={`flex items-start gap-2.5 p-3 rounded-card border text-left transition-all ${
                activePanel === tab.id
                  ? 'bg-brass/15 border-brass text-ink'
                  : 'bg-paper2 border-rule text-ink2 hover:bg-paper3'
              }`}
            >
              <div className="mt-0.5 text-brass">{tab.icon}</div>
              <div>
                <div className="text-xs font-semibold">{tab.label}</div>
                <div className="text-[10px] text-ink3 leading-tight mt-0.5 hidden sm:block">{tab.sub}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Center Video Monitor & Live Overlay Preview */}
        <div className="lg:col-span-4 bg-paper2 border border-rule rounded-card p-3 flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between text-xs text-ink3 mb-2">
            <span className="truncate font-medium text-ink2">
              {activeClip ? activeClip.title : 'No clip loaded'}
            </span>
            <span className="font-mono text-[11px]">
              {fmtTime(playhead)} / {fmtTime(videoDuration)}
            </span>
          </div>

          <div className="relative w-full max-w-[270px] aspect-[9/16] bg-black rounded-lg overflow-hidden border border-rule flex items-center justify-center">
            {activeClip?.video_url ? (
              <>
                <video
                  ref={videoRef}
                  src={getApiUrl(activeClip.video_url)}
                  className="w-full h-full object-contain transition-transform"
                  style={{ filter: liveCssFilter, transform: liveTransform }}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  controls
                />
                {/* Live Text Layers Preview */}
                {(recipe.text_layers || []).map((tl, idx) => (
                  <div
                    key={idx}
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded font-bold text-center shadow-lg"
                    style={{
                      top: `${tl.y_pct || 15}%`,
                      color: tl.color || '#FFF',
                      backgroundColor: tl.bg || '#EF4444',
                      fontSize: '13px',
                    }}
                  >
                    {tl.text}
                  </div>
                ))}
                {/* Live Stickers Preview */}
                {(recipe.stickers || []).map((st, idx) => (
                  <div
                    key={idx}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-2xl drop-shadow"
                    style={{ left: `${st.x_pct || 80}%`, top: `${st.y_pct || 22}%` }}
                  >
                    {st.text}
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center p-6 text-xs text-ink3">
                <Film size={28} className="mx-auto mb-2 opacity-50" />
                Select a clip above or click <b>Upload Video</b> to start editing in CapCut Studio.
              </div>
            )}
          </div>

          {/* Quick Playback & Download Bar */}
          <div className="w-full flex items-center justify-between gap-2 mt-3 pt-2 border-t border-rule">
            <button
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                if (v.paused) v.play();
                else v.pause();
              }}
              disabled={!activeClip}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-paper3 border border-rule text-xs text-ink"
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            {activeClip?.video_url && (
              <a
                href={getApiUrl(activeClip.video_url)}
                download={activeClip.filename || 'clarity_studio.mp4'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-paper3 hover:bg-paper border border-rule text-xs text-ink2"
              >
                <Download size={13} />
                <span>Download MP4</span>
              </a>
            )}
          </div>
        </div>

        {/* Right Inspector Panel (Dynamic per Category) */}
        <div className="lg:col-span-6 bg-paper2 border border-rule rounded-card p-4 space-y-4 max-h-[560px] overflow-y-auto">
          {/* PANEL 1: TIMELINE, MARKERS, BEATS, SPEED CURVES & KEYFRAMES */}
          {activePanel === 'timeline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-rule pb-2">
                <h3 className="text-sm font-semibold text-ink">Timeline Controls, Beats, Speed Curves & Keyframes</h3>
                <span className="text-[11px] text-ink3">{recipe.segments.length} segment(s)</span>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap gap-2">
                <button onClick={handleSplitAtPlayhead} className="px-2.5 py-1.5 rounded-input bg-paper3 border border-rule text-xs text-ink hover:border-brass flex items-center gap-1.5">
                  <Scissors size={13} /> Split at Playhead
                </button>
                <button onClick={handleDuplicateSegment} className="px-2.5 py-1.5 rounded-input bg-paper3 border border-rule text-xs text-ink hover:border-brass flex items-center gap-1.5">
                  <Copy size={13} /> Duplicate
                </button>
                <button onClick={handleMergeSegments} className="px-2.5 py-1.5 rounded-input bg-paper3 border border-rule text-xs text-ink hover:border-brass flex items-center gap-1.5">
                  <Merge size={13} /> Merge
                </button>
                <button onClick={handleDeleteSegment} className="px-2.5 py-1.5 rounded-input bg-paper3 border border-rule text-xs text-red-300 hover:border-red-400 flex items-center gap-1.5">
                  <Trash2 size={13} /> Delete
                </button>
                <button onClick={handleAddMarker} className="px-2.5 py-1.5 rounded-input bg-paper3 border border-rule text-xs text-ink hover:border-brass flex items-center gap-1.5">
                  <Flag size={13} /> + Marker
                </button>
                <button
                  onClick={handleDetectBeats}
                  disabled={!activeClip || busyAction === 'beats'}
                  className="px-2.5 py-1.5 rounded-input bg-brass/20 border border-brass/50 text-xs text-brass flex items-center gap-1.5"
                >
                  {busyAction === 'beats' ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />}
                  Auto-Detect Music Beats
                </button>
                {beatsData?.beats?.length > 0 && (
                  <button
                    onClick={handleSnapCutsToBeats}
                    className="px-2.5 py-1.5 rounded-input bg-emerald-500/20 border border-emerald-500/40 text-xs text-emerald-300"
                  >
                    Snap Cuts to Beats ({beatsData.bpm} BPM)
                  </button>
                )}
              </div>

              {/* Speed & Speed Curves */}
              <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">Speed & CapCut Velocity Curves</span>
                  <span className="text-xs font-mono text-brass">{recipe.speed}x</span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="4.0"
                  step="0.05"
                  value={recipe.speed}
                  onChange={(e) => updateRecipe({ speed: parseFloat(e.target.value) })}
                  className="w-full accent-brass"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(catalog?.speed_curves || []).map((sc) => (
                    <button
                      key={sc.id}
                      onClick={() => updateRecipe({ speed_curve: sc.id })}
                      className={`p-2 rounded border text-left text-xs ${
                        recipe.speed_curve === sc.id ? 'bg-brass/20 border-brass text-ink' : 'bg-paper2 border-rule text-ink2'
                      }`}
                    >
                      <div className="font-medium">{sc.name}</div>
                      <div className="text-[10px] text-ink3 truncate">{sc.description}</div>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-ink2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recipe.optical_flow}
                      onChange={(e) => updateRecipe({ optical_flow: e.target.checked })}
                    />
                    Optical Flow Smooth Slow-Mo
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-ink2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recipe.reverse}
                      onChange={(e) => updateRecipe({ reverse: e.target.checked })}
                    />
                    Reverse Footage
                  </label>
                  <button
                    onClick={() => updateRecipe({ freeze_at: Number(playhead.toFixed(2)), freeze_duration: 1.5 })}
                    className="px-2 py-1 rounded bg-paper2 border border-rule text-[11px] text-ink2 hover:border-brass"
                  >
                    ❄️ Freeze Frame (1.5s)
                  </button>
                </div>
              </div>

              {/* Transform, Mirror, Rotate, Crop & Keyframes */}
              <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">Transform, Crop & Motion Keyframes</span>
                  <button
                    onClick={handleAddKeyframe}
                    className="px-2.5 py-1 rounded bg-brass/20 border border-brass text-[11px] text-brass"
                  >
                    + Add Keyframe at {fmtTime(playhead)}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => updateRecipe({ mirror_h: !recipe.mirror_h })}
                    className={`px-2.5 py-1.5 rounded border text-xs flex items-center gap-1 ${
                      recipe.mirror_h ? 'bg-brass/20 border-brass text-ink' : 'bg-paper2 border-rule text-ink2'
                    }`}
                  >
                    <FlipHorizontal size={13} /> Mirror H
                  </button>
                  <button
                    onClick={() => updateRecipe({ mirror_v: !recipe.mirror_v })}
                    className={`px-2.5 py-1.5 rounded border text-xs flex items-center gap-1 ${
                      recipe.mirror_v ? 'bg-brass/20 border-brass text-ink' : 'bg-paper2 border-rule text-ink2'
                    }`}
                  >
                    <FlipVertical size={13} /> Flip V
                  </button>
                  <button
                    onClick={() => updateRecipe({ rotate: (recipe.rotate + 90) % 360 })}
                    className="px-2.5 py-1.5 rounded border border-rule bg-paper2 text-xs text-ink2"
                  >
                    Rotate {recipe.rotate}°
                  </button>

                  <select
                    value={recipe.crop_aspect}
                    onChange={(e) => updateRecipe({ crop_aspect: e.target.value })}
                    className="bg-paper2 border border-rule rounded px-2 py-1.5 text-xs text-ink"
                  >
                    <option value="original">Crop: Original</option>
                    <option value="9:16">Crop: 9:16 Vertical</option>
                    <option value="1:1">Crop: 1:1 Square</option>
                    <option value="16:9">Crop: 16:9 Widescreen</option>
                    <option value="4:5">Crop: 4:5 Feed</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink3 w-20">Scale / Zoom:</span>
                  <input
                    type="range"
                    min="1.0"
                    max="2.0"
                    step="0.05"
                    value={recipe.scale || 1.0}
                    onChange={(e) => updateRecipe({ scale: parseFloat(e.target.value) })}
                    className="flex-1 accent-brass"
                  />
                  <span className="text-xs font-mono w-12 text-right">{(recipe.scale || 1.0).toFixed(2)}x</span>
                </div>

                <label className="flex items-center gap-1.5 text-xs text-ink2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recipe.auto_zoom_keyframes}
                    onChange={(e) => updateRecipe({ auto_zoom_keyframes: e.target.checked })}
                  />
                  Enable Animated Keyframe Zoom Motion
                </label>
              </div>
            </div>
          )}

          {/* PANEL 2: FILTERS, COLOR GRADING, VFX, TRANSITIONS, MASKS & CHROMA KEY */}
          {activePanel === 'effects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-rule pb-2">
                <h3 className="text-sm font-semibold text-ink">Filters, HSL Color Grading, VFX, Masks & Chroma Key</h3>
                <button
                  onClick={handleAutoColor}
                  disabled={!activeClip || busyAction === 'autocolor'}
                  className="px-3 py-1 rounded bg-brass/20 border border-brass text-xs text-brass flex items-center gap-1"
                >
                  {busyAction === 'autocolor' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Auto Color Grade
                </button>
              </div>

              {/* Filter Presets */}
              <div>
                <div className="text-xs font-semibold text-ink2 mb-2">Free Video Filter & LUT Presets</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(catalog?.filters || []).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => updateRecipe({ filter: f.id })}
                      className={`p-2 rounded border text-left text-xs ${
                        recipe.filter === f.id ? 'bg-brass/20 border-brass text-ink' : 'bg-paper3 border-rule text-ink2'
                      }`}
                    >
                      <div className="font-medium truncate">{f.name}</div>
                      <div className="text-[10px] text-ink3">{f.category}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* HSL & Color Grading Sliders */}
              <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-2.5">
                <div className="text-xs font-semibold text-ink">HSL & Fine Color Sliders</div>
                {[
                  { key: 'brightness', label: 'Brightness', min: -0.3, max: 0.3, step: 0.02 },
                  { key: 'contrast', label: 'Contrast', min: 0.6, max: 1.6, step: 0.05 },
                  { key: 'saturation', label: 'Saturation', min: 0.0, max: 2.0, step: 0.05 },
                  { key: 'hue', label: 'Hue Shift (°)', min: -90, max: 90, step: 5 },
                  { key: 'warmth', label: 'Warmth / Temp', min: -0.25, max: 0.25, step: 0.02 },
                  { key: 'sharpness', label: 'Sharpness', min: 0.0, max: 1.5, step: 0.1 },
                ].map((sl) => (
                  <div key={sl.key} className="flex items-center gap-2 text-xs">
                    <span className="w-28 text-ink2">{sl.label}</span>
                    <input
                      type="range"
                      min={sl.min}
                      max={sl.max}
                      step={sl.step}
                      value={recipe.color?.[sl.key] ?? 0}
                      onChange={(e) =>
                        updateRecipe((prev) => ({
                          ...prev,
                          color: { ...prev.color, [sl.key]: parseFloat(e.target.value) },
                        }))
                      }
                      className="flex-1 accent-brass"
                    />
                    <span className="w-12 text-right font-mono text-[11px]">{recipe.color?.[sl.key]}</span>
                  </div>
                ))}
              </div>

              {/* Video Effects & Body/Face Effects */}
              <div>
                <div className="text-xs font-semibold text-ink2 mb-2">Video VFX & Body / Face Effects</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {(catalog?.effects || []).map((ef) => (
                    <button
                      key={ef.id}
                      onClick={() => updateRecipe({ effect: ef.id })}
                      className={`p-2 rounded border text-left text-xs ${
                        recipe.effect === ef.id ? 'bg-brass/20 border-brass text-ink' : 'bg-paper3 border-rule text-ink2'
                      }`}
                    >
                      <div className="font-medium truncate">{ef.name}</div>
                      <div className="text-[10px] text-ink3">{ef.category}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Transitions, Masks & Chroma Key */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-2">
                  <div className="text-xs font-semibold text-ink">Transition & Mask</div>
                  <select
                    value={recipe.transition}
                    onChange={(e) => updateRecipe({ transition: e.target.value })}
                    className="w-full bg-paper2 border border-rule rounded px-2 py-1.5 text-xs text-ink"
                  >
                    {(catalog?.transitions || []).map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        Transition: {tr.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={recipe.mask}
                    onChange={(e) => updateRecipe({ mask: e.target.value })}
                    className="w-full bg-paper2 border border-rule rounded px-2 py-1.5 text-xs text-ink"
                  >
                    <option value="none">Mask: None</option>
                    <option value="filmstrip">Mask: Cinematic Filmstrip Bars</option>
                    <option value="spotlight">Mask: Circle Subject Spotlight</option>
                    <option value="mirror_split">Mask: Mirror Split Screen</option>
                  </select>
                </div>

                <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-2">
                  <label className="flex items-center justify-between text-xs font-semibold text-ink cursor-pointer">
                    <span>Chroma Key (Green Screen)</span>
                    <input
                      type="checkbox"
                      checked={recipe.chroma_key?.enabled || false}
                      onChange={(e) =>
                        updateRecipe((prev) => ({
                          ...prev,
                          chroma_key: { ...prev.chroma_key, enabled: e.target.checked },
                        }))
                      }
                    />
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-ink3">Key Color:</span>
                    <input
                      type="color"
                      value={recipe.chroma_key?.color || '#00FF00'}
                      onChange={(e) =>
                        updateRecipe((prev) => ({
                          ...prev,
                          chroma_key: { ...prev.chroma_key, color: e.target.value },
                        }))
                      }
                    />
                    <span className="text-ink3 ml-2">Similarity:</span>
                    <input
                      type="range"
                      min="0.05"
                      max="0.6"
                      step="0.05"
                      value={recipe.chroma_key?.similarity || 0.25}
                      onChange={(e) =>
                        updateRecipe((prev) => ({
                          ...prev,
                          chroma_key: { ...prev.chroma_key, similarity: parseFloat(e.target.value) },
                        }))
                      }
                      className="w-24 accent-brass"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PANEL 3: TEXT OVERLAYS, STICKERS & AI CHARACTER TTS */}
          {activePanel === 'text' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-ink border-b border-rule pb-2">
                Text Overlays, Viral Templates, Stickers & AI Character TTS
              </h3>

              {/* Custom Text Overlay Builder */}
              <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-2.5">
                <div className="text-xs font-semibold text-ink">Add Custom Text Banner</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="Enter hook or title text..."
                    className="flex-1 bg-paper2 border border-rule rounded px-2.5 py-1.5 text-xs text-ink"
                  />
                  <input type="color" value={newTextColor} onChange={(e) => setNewTextColor(e.target.value)} title="Text Color" />
                  <input type="color" value={newTextBg} onChange={(e) => setNewTextBg(e.target.value)} title="Background Pill Color" />
                  <button
                    onClick={() => {
                      if (!newText.trim()) return;
                      updateRecipe((prev) => ({
                        ...prev,
                        text_layers: [
                          ...(prev.text_layers || []),
                          { text: newText.trim(), color: newTextColor, bg: newTextBg, size: 58, x_pct: 50, y_pct: newTextY },
                        ],
                      }));
                    }}
                    className="px-3 py-1.5 rounded bg-brass text-paper text-xs font-medium"
                  >
                    + Add Text
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink3">
                  <span>Vertical Position ({newTextY}%):</span>
                  <input
                    type="range"
                    min="8"
                    max="88"
                    value={newTextY}
                    onChange={(e) => setNewTextY(Number(e.target.value))}
                    className="flex-1 accent-brass"
                  />
                  {recipe.text_layers?.length > 0 && (
                    <button
                      onClick={() => updateRecipe({ text_layers: [] })}
                      className="text-red-300 underline text-[11px]"
                    >
                      Clear Texts ({recipe.text_layers.length})
                    </button>
                  )}
                </div>

                {/* One-click Trending Text Templates */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(catalog?.text_templates || []).map((tt) => (
                    <button
                      key={tt.id}
                      onClick={() =>
                        updateRecipe((prev) => ({
                          ...prev,
                          text_layers: [
                            ...(prev.text_layers || []),
                            { text: tt.text, color: tt.color, bg: tt.bg, size: tt.size, x_pct: 50, y_pct: tt.y_pct },
                          ],
                        }))
                      }
                      className="px-2 py-1 rounded bg-paper2 border border-rule text-[11px] text-ink2 hover:border-brass"
                    >
                      + {tt.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stickers */}
              <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">Sticker Overlays</span>
                  {recipe.stickers?.length > 0 && (
                    <button onClick={() => updateRecipe({ stickers: [] })} className="text-[11px] text-red-300 underline">
                      Clear Stickers ({recipe.stickers.length})
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(catalog?.stickers || []).map((st) => (
                    <button
                      key={st.id}
                      onClick={() =>
                        updateRecipe((prev) => ({
                          ...prev,
                          stickers: [
                            ...(prev.stickers || []),
                            { text: st.text, size: 84, x_pct: 20 + ((prev.stickers?.length || 0) * 18) % 65, y_pct: 22 },
                          ],
                        }))
                      }
                      className="px-2.5 py-1.5 rounded bg-paper2 border border-rule text-xs hover:border-brass"
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Character Text-to-Speech (TTS) */}
              <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-2.5">
                <div className="text-xs font-semibold text-ink">Text-to-Speech (TTS) & AI Character Voiceovers</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={ttsChar}
                    onChange={(e) => setTtsChar(e.target.value)}
                    className="bg-paper2 border border-rule rounded px-2.5 py-1.5 text-xs text-ink"
                  >
                    {(catalog?.tts_characters || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleGenerateTTS}
                    disabled={!ttsText.trim() || busyAction === 'tts'}
                    className="px-3 py-1.5 rounded bg-brass text-paper text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {busyAction === 'tts' ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />}
                    Generate AI Voiceover
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  placeholder="Type narration to convert into natural neural speech or character voiceover..."
                  className="w-full bg-paper2 border border-rule rounded p-2 text-xs text-ink"
                />
                {ttsResult && (
                  <div className="flex items-center justify-between text-xs text-emerald-300 bg-emerald-500/10 px-2.5 py-1.5 rounded">
                    <span>Ready: {ttsResult.character} ({ttsResult.duration}s)</span>
                    <audio src={getApiUrl(ttsResult.audio_url)} controls className="h-7" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PANEL 4: MUSIC LIBRARY, SFX LIBRARY & VOICE ENHANCEMENT */}
          {activePanel === 'audio' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-ink border-b border-rule pb-2">
                Royalty-Free Music, Viral Sound Effects (SFX) & Studio Voice Enhancement
              </h3>

              {/* Voice Enhancement & Creative Voice FX */}
              <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-2.5">
                <div className="text-xs font-semibold text-ink">Voice Enhancement & Noise Removal</div>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-ink2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recipe.noise_removal}
                      onChange={(e) => updateRecipe({ noise_removal: e.target.checked })}
                    />
                    FFT Background Noise Removal
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-ink2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recipe.voice_isolation}
                      onChange={(e) => updateRecipe({ voice_isolation: e.target.checked })}
                    />
                    Vocal Isolation
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-ink2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recipe.voice_enhance}
                      onChange={(e) => updateRecipe({ voice_enhance: e.target.checked })}
                    />
                    Studio Podcast Vocal Polish (EQ + Comp + Loudnorm)
                  </label>
                </div>

                <div className="pt-1">
                  <div className="text-xs text-ink3 mb-1">Creative Voice Effect:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(catalog?.voice_effects || []).map((vf) => (
                      <button
                        key={vf.id}
                        onClick={() => updateRecipe({ voice_effect: vf.id })}
                        className={`p-2 rounded border text-left text-xs ${
                          recipe.voice_effect === vf.id ? 'bg-brass/20 border-brass text-ink' : 'bg-paper2 border-rule text-ink2'
                        }`}
                      >
                        {vf.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Built-in Royalty-Free Background Music */}
              <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">Built-in Royalty-Free Background Music</span>
                  {recipe.music && (
                    <button onClick={() => updateRecipe({ music: '' })} className="text-[11px] text-red-300 underline">
                      Remove Music
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {(catalog?.music_library || []).map((m) => (
                    <div
                      key={m.id}
                      className={`p-2 rounded border flex items-center justify-between text-xs ${
                        recipe.music === m.id ? 'bg-brass/20 border-brass text-ink' : 'bg-paper2 border-rule text-ink2'
                      }`}
                    >
                      <button onClick={() => updateRecipe({ music: m.id })} className="text-left flex-1">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-[10px] text-ink3">{m.category} • {m.bpm} BPM</div>
                      </button>
                      <button
                        onClick={() => previewAudioAsset('music', m.id)}
                        className="px-2 py-1 rounded bg-paper3 border border-rule text-[10px] hover:border-brass"
                      >
                        ▶ Preview
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Viral Sound Effects (SFX) */}
              <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">Viral Sound Effects (SFX)</span>
                  {recipe.sfx && (
                    <button onClick={() => updateRecipe({ sfx: '' })} className="text-[11px] text-red-300 underline">
                      Remove SFX
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {(catalog?.sfx_library || []).map((s) => (
                    <div
                      key={s.id}
                      className={`p-2 rounded border flex items-center justify-between text-xs ${
                        recipe.sfx === s.id ? 'bg-brass/20 border-brass text-ink' : 'bg-paper2 border-rule text-ink2'
                      }`}
                    >
                      <button
                        onClick={() => updateRecipe({ sfx: s.id, sfx_time: Number(playhead.toFixed(2)) })}
                        className="text-left truncate flex-1"
                      >
                        <div className="font-medium truncate">{s.name}</div>
                        <div className="text-[10px] text-ink3">{s.duration}s</div>
                      </button>
                      <button
                        onClick={() => previewAudioAsset('sfx', s.id)}
                        className="px-1.5 py-0.5 rounded bg-paper3 text-[10px]"
                      >
                        ▶
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PANEL 5: AI SMART TOOLS & TRENDING TEMPLATES */}
          {activePanel === 'ai' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-ink border-b border-rule pb-2">
                AI Edit Pilot, Silence Remover, Background Remover, Upscaler & Templates
              </h3>

              {/* AI Edit Pilot + Smart Silence Removal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-2">
                  <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <Sparkles size={14} className="text-brass" /> AI Edit Pilot (Post-Production Assistant)
                  </div>
                  <p className="text-[11px] text-ink3">
                    Automatically analyzes transcript hooks, audio beats, silent pauses, and frame lighting to configure your edit.
                  </p>
                  <button
                    onClick={handleRunEditPilot}
                    disabled={!activeClip || busyAction === 'pilot'}
                    className="w-full py-1.5 rounded bg-brass text-paper text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    {busyAction === 'pilot' ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                    Run AI Edit Pilot
                  </button>
                  {pilotSummary && <p className="text-[11px] text-emerald-300 mt-1">{pilotSummary}</p>}
                </div>

                <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-2">
                  <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <Scissors size={14} className="text-brass" /> Smart Silence & Pause Removal
                  </div>
                  <p className="text-[11px] text-ink3">
                    Automatically detects dead air in spoken videos and slices the timeline into tight jump-cuts.
                  </p>
                  <button
                    onClick={handleRemoveSilence}
                    disabled={!activeClip || busyAction === 'silence'}
                    className="w-full py-1.5 rounded bg-paper2 hover:bg-paper border border-brass/50 text-brass text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    {busyAction === 'silence' ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                    Auto-Cut Silent Pauses
                  </button>
                  {silenceData && (
                    <p className="text-[11px] text-emerald-300">
                      Removed {silenceData.removed_seconds}s across {silenceData.silences_found} pauses!
                    </p>
                  )}
                </div>
              </div>

              {/* AI Background Removal & AI Video Upscaler */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-2">
                  <div className="text-xs font-semibold text-ink">AI Background Removal (No Green Screen)</div>
                  <div className="flex items-center gap-2">
                    <select
                      value={bgMode}
                      onChange={(e) => setBgMode(e.target.value)}
                      className="flex-1 bg-paper2 border border-rule rounded px-2 py-1 text-xs text-ink"
                    >
                      <option value="blur">Portrait Bokeh Blur BG</option>
                      <option value="color">Solid Studio Color / Virtual Green Screen</option>
                    </select>
                    {bgMode === 'color' && (
                      <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
                    )}
                  </div>
                  <button
                    onClick={handleRemoveBackground}
                    disabled={!activeClip || busyAction === 'removebg'}
                    className="w-full py-1.5 rounded bg-paper2 border border-rule hover:border-brass text-xs text-ink flex items-center justify-center gap-1.5"
                  >
                    {busyAction === 'removebg' ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />}
                    Apply Background Removal
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-paper3 border border-rule space-y-2">
                  <div className="text-xs font-semibold text-ink">AI Video Quality Enhancer & Upscaler</div>
                  <div className="flex items-center gap-2 text-xs">
                    <select
                      value={upscaleRes}
                      onChange={(e) => setUpscaleRes(e.target.value)}
                      className="bg-paper2 border border-rule rounded px-2 py-1 text-xs text-ink"
                    >
                      <option value="1080p">1080p Full HD + CAS Sharpen</option>
                      <option value="2k">2K QHD Super-Resolution</option>
                      <option value="4k">4K UHD Master</option>
                    </select>
                    <label className="flex items-center gap-1 text-ink2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={upscale60fps}
                        onChange={(e) => setUpscale60fps(e.target.checked)}
                      />
                      60fps
                    </label>
                  </div>
                  <button
                    onClick={handleUpscaleVideo}
                    disabled={!activeClip || busyAction === 'upscale'}
                    className="w-full py-1.5 rounded bg-paper2 border border-rule hover:border-brass text-xs text-ink flex items-center justify-center gap-1.5"
                  >
                    {busyAction === 'upscale' ? <Loader2 size={13} className="animate-spin" /> : <Maximize2 size={13} />}
                    Upscale & Denoise Video
                  </button>
                </div>
              </div>

              {/* Trending Short-Form Video Templates */}
              <div>
                <div className="text-xs font-semibold text-ink2 mb-2">Trending Short-Form Video Templates (1-Click Apply)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(catalog?.templates || []).map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-2.5 rounded-lg bg-paper3 border border-rule flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink">{tpl.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-brass/15 text-brass">{tpl.category}</span>
                        </div>
                        <p className="text-[11px] text-ink3 mt-0.5">{tpl.description}</p>
                      </div>
                      <button
                        onClick={() => handleApplyTemplate(tpl)}
                        className="self-start px-2.5 py-1 rounded bg-paper2 hover:bg-brass hover:text-paper border border-rule text-[11px] text-ink2 transition-colors"
                      >
                        Use Template
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Track Interactive Visual Timeline Bar */}
      <div className="bg-paper2 border border-rule rounded-card p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-ink">Multi-Layer Timeline</span>
            <span className="text-ink3">
              Playhead: <b className="text-brass font-mono">{fmtTime(playhead)}</b>
            </span>
            {recipe.markers?.length > 0 && (
              <span className="text-ink3">Markers/Beats: {recipe.markers.length}</span>
            )}
          </div>
          <input
            type="range"
            min="0"
            max={videoDuration || 30}
            step="0.05"
            value={playhead}
            onChange={(e) => {
              const t = parseFloat(e.target.value);
              setPlayhead(t);
              if (videoRef.current) videoRef.current.currentTime = t;
            }}
            className="w-48 sm:w-72 accent-brass"
          />
        </div>

        {/* Track M1: Markers & Beats */}
        <div className="relative h-5 bg-paper3 rounded border border-rule overflow-hidden flex items-center px-2">
          <span className="text-[10px] font-mono text-ink3 z-10">M1 MARKERS / BEATS</span>
          {(recipe.markers || []).map((m, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPlayhead(m.time);
                if (videoRef.current) videoRef.current.currentTime = m.time;
              }}
              style={{ left: `${Math.min(98, (m.time / (videoDuration || 30)) * 100)}%` }}
              className={`absolute top-0 bottom-0 w-1 ${m.isBeat ? 'bg-emerald-400/80' : 'bg-brass'}`}
              title={`${m.label} @ ${fmtTime(m.time)}`}
            />
          ))}
        </div>

        {/* Track V1: Video Segments */}
        <div className="flex gap-1 h-9 bg-paper3 rounded border border-rule p-1 overflow-x-auto">
          {recipe.segments.map((seg, idx) => {
            const widthPct = Math.max(8, ((seg.end - seg.start) / (videoDuration || 30)) * 100);
            return (
              <button
                key={idx}
                onClick={() => setSelectedSegIdx(idx)}
                style={{ width: `${widthPct}%` }}
                className={`h-full rounded px-2 flex items-center justify-between text-[11px] truncate transition-all ${
                  selectedSegIdx === idx
                    ? 'bg-brass text-paper font-semibold'
                    : 'bg-paper2 text-ink2 border border-rule'
                }`}
              >
                <span className="truncate">{seg.label || `Seg ${idx + 1}`}</span>
                <span className="font-mono text-[10px] opacity-80">
                  {fmtTime(seg.start)}-{fmtTime(seg.end)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Track T1 & A1 Summary Tracks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
          <div className="px-2.5 py-1 rounded bg-paper3 border border-rule text-ink2 flex items-center justify-between">
            <span>T1 OVERLAYS: {recipe.text_layers?.length || 0} text(s), {recipe.stickers?.length || 0} sticker(s)</span>
            <span className="text-brass font-mono">Filter: {recipe.filter} | VFX: {recipe.effect}</span>
          </div>
          <div className="px-2.5 py-1 rounded bg-paper3 border border-rule text-ink2 flex items-center justify-between">
            <span>
              A1 AUDIO: {recipe.music ? `Music (${recipe.music})` : 'Orig Audio'}
              {recipe.sfx ? ` + SFX (${recipe.sfx})` : ''}
              {recipe.tts_filename ? ' + AI Voiceover' : ''}
            </span>
            <span className="text-emerald-400 font-mono">
              {recipe.voice_enhance ? 'Studio EQ' : recipe.voice_effect}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
