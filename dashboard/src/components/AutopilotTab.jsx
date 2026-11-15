import React, { useState, useEffect } from 'react';
import { Radio, Youtube, Play, Square, Scissors, RefreshCw, Plus, Trash2, Volume2, MessageSquare, Users, Sparkles, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { getApiUrl } from '../config';
import { apiFetch } from '../lib/api';

export default function AutopilotTab({ geminiApiKey, onOpenJob }) {
  const [activeSubTab, setActiveSubTab] = useState('channel'); // 'channel' | 'live' | 'creators'
  const [config, setConfig] = useState({
    enabled: false,
    channel_url: '',
    max_clips_per_video: 5,
    clip_min_seconds: 15,
    clip_max_seconds: 60,
    output_format: 'vertical',
    auto_hook: true,
    recent_jobs: [],
  });
  const [channelVideos, setChannelVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [runningJob, setRunningJob] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Live Stream Clipper state (PeakCut)
  const [liveUrl, setLiveUrl] = useState('');
  const [liveWindowSec, setLiveWindowSec] = useState(45);
  const [liveLoudnessSpike, setLiveLoudnessSpike] = useState(true);
  const [liveChatSpike, setLiveChatSpike] = useState(true);
  const [liveSessions, setLiveSessions] = useState([]);
  const [startingLive, setStartingLive] = useState(false);
  const [clippingSessionId, setClippingSessionId] = useState(null);

  // Creator Workspaces state (PeakCut)
  const [creators, setCreators] = useState([]);
  const [newCreatorName, setNewCreatorName] = useState('');
  const [newCreatorChannel, setNewCreatorChannel] = useState('');
  const [newCreatorPhrases, setNewCreatorPhrases] = useState('clip that, clip it, mark that');

  const loadState = async () => {
    try {
      const res = await apiFetch('/api/autopilot');
      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig((prev) => ({ ...prev, ...data.config }));
        if (data.live_sessions) setLiveSessions(data.live_sessions);
        if (data.creators) setCreators(data.creators);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadState();
    const timer = setInterval(() => {
      apiFetch('/api/live/sessions')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.sessions) setLiveSessions(d.sessions);
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleSaveConfig = async (updates = {}) => {
    const merged = { ...config, ...updates };
    setConfig(merged);
    try {
      const res = await apiFetch('/api/autopilot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig(data.config);
        setStatusMsg({ type: 'ok', text: 'Autopilot configuration saved.' });
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (e) {
      setStatusMsg({ type: 'err', text: e.message });
    }
  };

  const handleFetchChannelVideos = async (urlOverride) => {
    const target = (urlOverride ?? config.channel_url ?? '').trim();
    if (!target) return;
    setLoadingVideos(true);
    setStatusMsg(null);
    try {
      await handleSaveConfig({ channel_url: target });
      const res = await apiFetch(`/api/autopilot/videos?url=${encodeURIComponent(target)}&limit=8`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setChannelVideos(data.videos || []);
    } catch (e) {
      setStatusMsg({ type: 'err', text: `Failed to fetch channel videos: ${e.message}` });
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleClipChannelVideo = async (videoUrl = null) => {
    setRunningJob(true);
    setStatusMsg(null);
    try {
      const apiKey = geminiApiKey || localStorage.getItem('gemini_key');
      const headers = {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Gemini-Key': apiKey } : {}),
      };
      const res = await apiFetch('/api/autopilot/run', {
        method: 'POST',
        headers,
        body: JSON.stringify({ video_url: videoUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to start clipping job' }));
        throw new Error(err.detail?.message || err.detail || 'Failed to start job');
      }
      const data = await res.json();
      setStatusMsg({ type: 'ok', text: `Clipping job started! Job ID: ${data.job_id?.slice(0, 8)}` });
      loadState();
      if (data.job_id && onOpenJob) {
        onOpenJob(data.job_id);
      }
    } catch (e) {
      setStatusMsg({ type: 'err', text: e.message });
    } finally {
      setRunningJob(false);
    }
  };

  const handleStartLive = async () => {
    if (!liveUrl.trim()) return;
    setStartingLive(true);
    setStatusMsg(null);
    try {
      const res = await apiFetch('/api/live/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: liveUrl.trim(),
          window_sec: Number(liveWindowSec) || 45,
          loudness_spike: liveLoudnessSpike,
          chat_spike: liveChatSpike,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const session = await res.json();
      setLiveSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
      setLiveUrl('');
      setStatusMsg({ type: 'ok', text: 'Live stream recorder started! Buffering 6s segments...' });
    } catch (e) {
      setStatusMsg({ type: 'err', text: e.message });
    } finally {
      setStartingLive(false);
    }
  };

  const handleStopLive = async (sessionId) => {
    try {
      await apiFetch(`/api/live/stop/${encodeURIComponent(sessionId)}`, { method: 'POST' });
      loadState();
    } catch {
      // ignore
    }
  };

  const handleClipLiveNow = async (sessionId, seconds = 30) => {
    setClippingSessionId(`${sessionId}_${seconds}`);
    setStatusMsg(null);
    try {
      const res = await apiFetch(`/api/live/clip-now/${encodeURIComponent(sessionId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Buffer not ready yet' }));
        throw new Error(err.detail || 'Could not cut live clip yet');
      }
      const data = await res.json();
      setStatusMsg({ type: 'ok', text: `Live ${seconds}s vertical clip rendered: ${data.clip?.title}` });
      loadState();
    } catch (e) {
      setStatusMsg({ type: 'err', text: e.message });
    } finally {
      setClippingSessionId(null);
    }
  };

  const handleCreateCreator = async () => {
    if (!newCreatorName.trim()) return;
    try {
      const phrases = newCreatorPhrases
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const res = await apiFetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCreatorName.trim(),
          channel_url: newCreatorChannel.trim(),
          trigger_phrases: phrases,
        }),
      });
      if (res.ok) {
        setNewCreatorName('');
        setNewCreatorChannel('');
        loadState();
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteCreator = async (cid) => {
    await apiFetch(`/api/creators/${encodeURIComponent(cid)}`, { method: 'DELETE' });
    loadState();
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="eyebrow mb-2">06 · FREE AUTOPILOT & LIVE STREAM CLIPPER</p>
            <h1 className="font-display lowercase text-2xl text-ink">Channel Autopilot & Live Clipper</h1>
            <p className="text-sm lowercase text-muted mt-1">
              Watch any YouTube, Twitch, or Kick channel for free — or record live streams in real time with loudness & Twitch chat spike clipping
            </p>
          </div>

          <div className="flex rounded-input border border-rule overflow-hidden">
            <button
              onClick={() => setActiveSubTab('channel')}
              className={`px-3.5 py-2 text-xs lowercase flex items-center gap-1.5 transition-colors ${
                activeSubTab === 'channel' ? 'bg-ink text-paper' : 'bg-paper2 text-muted hover:text-ink'
              }`}
            >
              <Youtube size={14} /> channel autopilot
            </button>
            <button
              onClick={() => setActiveSubTab('live')}
              className={`px-3.5 py-2 text-xs lowercase flex items-center gap-1.5 transition-colors ${
                activeSubTab === 'live' ? 'bg-ink text-paper' : 'bg-paper2 text-muted hover:text-ink'
              }`}
            >
              <Radio size={14} /> live stream clipper
            </button>
            <button
              onClick={() => setActiveSubTab('creators')}
              className={`px-3.5 py-2 text-xs lowercase flex items-center gap-1.5 transition-colors ${
                activeSubTab === 'creators' ? 'bg-ink text-paper' : 'bg-paper2 text-muted hover:text-ink'
              }`}
            >
              <Users size={14} /> creator workspaces ({creators.length})
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className={`mb-6 p-3.5 rounded-input border flex items-center gap-2.5 text-xs ${
            statusMsg.type === 'ok'
              ? 'bg-ok/10 border-ok/30 text-ok'
              : 'bg-danger/10 border-danger/30 text-danger'
          }`}>
            {statusMsg.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* SUB-TAB 1: FREE CHANNEL AUTOPILOT */}
        {activeSubTab === 'channel' && (
          <div className="space-y-6 animate-fade">
            <div className="card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-medium text-ink lowercase">Channel Watcher & One-Click Clipper</h2>
                  <p className="text-xs text-muted mt-0.5">
                    Paste any YouTube (@handle or channel URL), Twitch, or Kick channel URL — 100% free via yt-dlp, no OAuth or paid plan required.
                  </p>
                </div>
                <span className="badge-ok"><Sparkles size={11} /> 100% Free</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="url"
                  value={config.channel_url || ''}
                  onChange={(e) => setConfig({ ...config, channel_url: e.target.value })}
                  placeholder="https://www.youtube.com/@mkbhd/videos or https://www.twitch.tv/..."
                  className="input-field flex-1"
                />
                <button
                  onClick={() => handleFetchChannelVideos()}
                  disabled={loadingVideos || !(config.channel_url || '').trim()}
                  className="btn-ghost px-4 py-2.5 text-xs shrink-0"
                >
                  {loadingVideos ? <Loader2Icon /> : <RefreshCw size={14} />}
                  {loadingVideos ? 'fetching videos...' : 'fetch latest videos'}
                </button>
                <button
                  onClick={() => handleClipChannelVideo(null)}
                  disabled={runningJob || !(config.channel_url || '').trim()}
                  className="btn-primary px-5 py-2.5 text-xs shrink-0"
                >
                  <Scissors size={14} />
                  {runningJob ? 'starting job...' : 'clip latest video now'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-rule">
                <div>
                  <label className="eyebrow block mb-1.5">Target Clips Per Video</label>
                  <select
                    value={config.max_clips_per_video || 5}
                    onChange={(e) => handleSaveConfig({ max_clips_per_video: Number(e.target.value) })}
                    className="input-field text-xs"
                  >
                    {[3, 5, 8, 10, 12].map((n) => (
                      <option key={n} value={n}>{n} clips</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="eyebrow block mb-1.5">Clip Length Band</label>
                  <select
                    value={`${config.clip_min_seconds || 15}-${config.clip_max_seconds || 60}`}
                    onChange={(e) => {
                      const [lo, hi] = e.target.value.split('-').map(Number);
                      handleSaveConfig({ clip_min_seconds: lo, clip_max_seconds: hi });
                    }}
                    className="input-field text-xs"
                  >
                    <option value="15-45">15s – 45s (Fast Shorts)</option>
                    <option value="15-60">15s – 60s (Standard Viral)</option>
                    <option value="30-90">30s – 90s (Deep Story)</option>
                  </select>
                </div>
                <div>
                  <label className="eyebrow block mb-1.5">Auto Viral Hook Banner</label>
                  <button
                    onClick={() => handleSaveConfig({ auto_hook: !config.auto_hook })}
                    className={`w-full py-2.5 px-3 rounded-input border text-xs lowercase flex items-center justify-between ${
                      config.auto_hook ? 'border-brass bg-paper3 text-ink' : 'border-rule bg-paper text-muted'
                    }`}
                  >
                    <span>{config.auto_hook ? 'enabled (burns viral hook)' : 'disabled'}</span>
                    {config.auto_hook && <Check size={13} className="text-brass" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Channel Videos List */}
            {channelVideos.length > 0 && (
              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="eyebrow">Latest Channel Videos ({channelVideos.length})</h3>
                  <span className="readout">click any video to generate shorts</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {channelVideos.map((v) => (
                    <div key={v.id} className="bg-paper rounded-input border border-rule overflow-hidden flex flex-col justify-between">
                      <div>
                        {v.thumbnail ? (
                          <div className="aspect-video bg-black relative">
                            <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" />
                            {v.duration > 0 && (
                              <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-ink font-mono text-micro px-1.5 py-0.5 rounded">
                                {Math.floor(v.duration / 60)}m {Math.round(v.duration % 60)}s
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="aspect-video bg-paper3 flex items-center justify-center">
                            <Youtube size={24} className="text-muted" />
                          </div>
                        )}
                        <div className="p-3">
                          <p className="text-xs font-medium text-ink line-clamp-2">{v.title}</p>
                        </div>
                      </div>
                      <div className="p-3 pt-0">
                        <button
                          onClick={() => handleClipChannelVideo(v.url)}
                          disabled={runningJob}
                          className="btn-primary w-full py-1.5 text-xs"
                        >
                          <Scissors size={12} /> clip this video
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Autopilot Jobs */}
            {(config.recent_jobs || []).length > 0 && (
              <div className="card p-6 space-y-3">
                <h3 className="eyebrow">Recent Autopilot Jobs</h3>
                <div className="divide-y divide-rule border-y border-rule">
                  {config.recent_jobs.map((j) => (
                    <div key={j.job_id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="font-mono text-ink mr-2">{j.job_id.slice(0, 8)}</span>
                        <span className="text-muted truncate">{j.video_url}</span>
                      </div>
                      {onOpenJob && (
                        <button
                          onClick={() => onOpenJob(j.job_id)}
                          className="btn-ghost px-3 py-1 text-xs shrink-0"
                        >
                          <ExternalLink size={12} /> open job
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 2: PEAKCUT LIVE STREAM RECORDER & REAL-TIME CLIPPER */}
        {activeSubTab === 'live' && (
          <div className="space-y-6 animate-fade">
            <div className="card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-medium text-ink lowercase">Live Stream Recorder & Instant Clipper</h2>
                  <p className="text-xs text-muted mt-0.5">
                    Ported from PeakCut — buffers live YouTube, Twitch, or Kick streams into rolling 6s segments, detects audio loudness spikes & Twitch IRC chat velocity jumps, and lets you clip the last 30s/60s in real time!
                  </p>
                </div>
                <span className="badge-brass"><Radio size={11} /> Real-Time</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="url"
                  value={liveUrl}
                  onChange={(e) => setLiveUrl(e.target.value)}
                  placeholder="https://www.twitch.tv/streamer or YouTube/Kick live URL..."
                  className="input-field flex-1"
                />
                <button
                  onClick={handleStartLive}
                  disabled={startingLive || !liveUrl.trim()}
                  className="btn-primary px-5 py-2.5 text-xs shrink-0"
                >
                  <Radio size={14} />
                  {startingLive ? 'connecting stream...' : 'start live recording'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-rule">
                <div>
                  <label className="eyebrow block mb-1.5">Default Clip Window</label>
                  <select
                    value={liveWindowSec}
                    onChange={(e) => setLiveWindowSec(Number(e.target.value))}
                    className="input-field text-xs"
                  >
                    <option value={30}>Last 30 seconds</option>
                    <option value={45}>Last 45 seconds</option>
                    <option value={60}>Last 60 seconds</option>
                  </select>
                </div>
                <div>
                  <label className="eyebrow block mb-1.5">Audio Loudness Spike Detector</label>
                  <button
                    onClick={() => setLiveLoudnessSpike(!liveLoudnessSpike)}
                    className={`w-full py-2.5 px-3 rounded-input border text-xs lowercase flex items-center justify-between ${
                      liveLoudnessSpike ? 'border-brass bg-paper3 text-ink' : 'border-rule bg-paper text-muted'
                    }`}
                  >
                    <span className="flex items-center gap-1.5"><Volume2 size={13} /> +8 dB hype spike</span>
                    {liveLoudnessSpike && <Check size={13} className="text-brass" />}
                  </button>
                </div>
                <div>
                  <label className="eyebrow block mb-1.5">Twitch IRC Chat Spike Detector</label>
                  <button
                    onClick={() => setLiveChatSpike(!liveChatSpike)}
                    className={`w-full py-2.5 px-3 rounded-input border text-xs lowercase flex items-center justify-between ${
                      liveChatSpike ? 'border-brass bg-paper3 text-ink' : 'border-rule bg-paper text-muted'
                    }`}
                  >
                    <span className="flex items-center gap-1.5"><MessageSquare size={13} /> 3x chat velocity</span>
                    {liveChatSpike && <Check size={13} className="text-brass" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Active & Past Live Sessions */}
            <div className="space-y-4">
              {liveSessions.length === 0 ? (
                <div className="card p-10 text-center space-y-2">
                  <Radio size={22} className="text-muted mx-auto" />
                  <p className="text-sm text-ink lowercase">No active live stream sessions</p>
                  <p className="text-xs text-muted">Paste a live Twitch, YouTube, or Kick URL above to start rolling capture and real-time clipping.</p>
                </div>
              ) : (
                liveSessions.map((sess) => (
                  <div key={sess.id} className="card p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${sess.state === 'recording' ? 'bg-ok animate-pulse' : 'bg-muted'}`} />
                        <div>
                          <h3 className="text-sm font-medium text-ink">{sess.url}</h3>
                          <div className="flex flex-wrap items-center gap-3 mt-0.5">
                            <span className="readout uppercase">{sess.state}</span>
                            <span className="readout">buffer: {Math.round(sess.buffered_seconds || 0)}s ({sess.segments_count || 0} segs)</span>
                            <span className="readout">loudness: {sess.last_loudness_db} dB</span>
                            {sess.twitch_channel && <span className="readout">twitch chat: #{sess.twitch_channel} ({sess.chat_rate_per_10s}/10s)</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {sess.state === 'recording' && (
                          <>
                            <button
                              onClick={() => handleClipLiveNow(sess.id, 30)}
                              disabled={clippingSessionId === `${sess.id}_30`}
                              className="btn-primary px-3.5 py-2 text-xs"
                            >
                              <Scissors size={13} />
                              {clippingSessionId === `${sess.id}_30` ? 'clipping...' : 'clip last 30s'}
                            </button>
                            <button
                              onClick={() => handleClipLiveNow(sess.id, 60)}
                              disabled={clippingSessionId === `${sess.id}_60`}
                              className="btn-ghost px-3.5 py-2 text-xs"
                            >
                              <Scissors size={13} />
                              {clippingSessionId === `${sess.id}_60` ? 'clipping...' : 'clip last 60s'}
                            </button>
                            <button
                              onClick={() => handleStopLive(sess.id)}
                              className="btn-ghost px-3 py-2 text-xs text-danger"
                            >
                              <Square size={13} /> stop
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Clips captured from this live session */}
                    {(sess.clips || []).length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-rule">
                        {sess.clips.map((c) => (
                          <div key={c.id} className="bg-paper rounded-input border border-rule overflow-hidden">
                            <div className="aspect-[9/16] max-h-72 bg-black">
                              <video src={getApiUrl(c.video_url)} controls playsInline className="w-full h-full object-contain" />
                            </div>
                            <div className="p-3 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-ink truncate">{c.title}</p>
                                <span className="readout">{c.reason} · {c.duration}s</span>
                              </div>
                              <a href={getApiUrl(c.video_url)} download className="btn-primary px-2.5 py-1 text-xs shrink-0">
                                save
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SUB-TAB 3: CREATOR WORKSPACES (PEAKCUT) */}
        {activeSubTab === 'creators' && (
          <div className="space-y-6 animate-fade">
            <div className="card p-6 space-y-4">
              <h2 className="text-base font-medium text-ink lowercase">Creator Workspaces</h2>
              <p className="text-xs text-muted">
                Save your favorite channels and streamers with custom voice trigger phrases (e.g. &ldquo;clip that&rdquo;, &ldquo;mark that&rdquo;) for one-click loading in Autopilot & Live Clipper.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newCreatorName}
                  onChange={(e) => setNewCreatorName(e.target.value)}
                  placeholder="Creator / Channel Name"
                  className="input-field text-xs"
                />
                <input
                  type="url"
                  value={newCreatorChannel}
                  onChange={(e) => setNewCreatorChannel(e.target.value)}
                  placeholder="https://youtube.com/@... or twitch.tv/..."
                  className="input-field text-xs"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCreatorPhrases}
                    onChange={(e) => setNewCreatorPhrases(e.target.value)}
                    placeholder="Trigger phrases (comma-separated)"
                    className="input-field text-xs flex-1"
                  />
                  <button onClick={handleCreateCreator} className="btn-primary px-4 py-2 text-xs shrink-0">
                    <Plus size={14} /> add
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {creators.map((c) => (
                <div key={c.id} className="card p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-ink">{c.name}</h3>
                      <button onClick={() => handleDeleteCreator(c.id)} className="text-muted hover:text-danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {c.channel_url && <p className="text-xs text-muted truncate mt-1">{c.channel_url}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {(c.trigger_phrases || []).map((p, idx) => (
                        <span key={idx} className="readout bg-paper3 px-2 py-0.5 rounded-full">
                          &ldquo;{p}&rdquo;
                        </span>
                      ))}
                    </div>
                  </div>
                  {c.channel_url && (
                    <div className="flex gap-2 pt-3 border-t border-rule">
                      <button
                        onClick={() => {
                          setActiveSubTab('channel');
                          handleFetchChannelVideos(c.channel_url);
                        }}
                        className="btn-ghost py-1.5 px-3 text-xs flex-1"
                      >
                        load in autopilot
                      </button>
                      <button
                        onClick={() => {
                          setLiveUrl(c.channel_url);
                          setActiveSubTab('live');
                        }}
                        className="btn-primary py-1.5 px-3 text-xs flex-1"
                      >
                        open in live clipper
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Loader2Icon() {
  return <RefreshCw size={14} className="animate-spin" />;
}
