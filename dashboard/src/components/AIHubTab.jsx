import React, { useState, useEffect } from 'react';
import { Cpu, Check, AlertCircle, RefreshCw, Activity, ShieldCheck, Download, Trash2, Sparkles, Server, Zap } from 'lucide-react';
import { apiFetch } from '../lib/api';

const OLLAMA_PRESET_MODELS = [
  'llama3.1:8b',
  'qwen2.5:7b',
  'mistral:7b',
  'gemma2:9b',
  'deepseek-r1:7b',
];

export default function AIHubTab({ onGeminiKeySaved }) {
  const [providers, setProviders] = useState({});
  const [settings, setSettings] = useState({
    provider: 'gemini',
    api_key: '',
    base_url: '',
    models: ['gemini-2.5-flash'],
  });
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState(null);

  // Environment & Ollama Pull (AutoShorts)
  const [envStatus, setEnvStatus] = useState(null);
  const [ollamaModelToPull, setOllamaModelToPull] = useState('llama3.1:8b');
  const [pullingOllama, setPullingOllama] = useState(false);
  const [pullResult, setPullResult] = useState(null);

  // Usage Dashboard (PeakCut)
  const [usage, setUsage] = useState({ total_calls: 0, total_tokens: 0, by_provider: {}, recent: [] });

  // YouTube Copyright & License Checker (AutoShorts)
  const [ytCheckUrl, setYtCheckUrl] = useState('');
  const [checkingCopyright, setCheckingCopyright] = useState(false);
  const [copyrightResult, setCopyrightResult] = useState(null);

  const loadAll = async () => {
    try {
      const [sRes, uRes, eRes] = await Promise.all([
        apiFetch('/api/ai/settings'),
        apiFetch('/api/ai/usage'),
        apiFetch('/api/ai/environment'),
      ]);
      if (sRes.ok) {
        const d = await sRes.json();
        if (d.providers) setProviders(d.providers);
        if (d.settings) {
          setSettings(d.settings);
          setAvailableModels(d.settings.models || []);
        }
      }
      if (uRes.ok) setUsage(await uRes.json());
      if (eRes.ok) setEnvStatus(await eRes.json());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleProviderChange = (prov) => {
    const meta = providers[prov] || {};
    const defaultModels = meta.default_models || [];
    setSettings((prev) => ({
      ...prev,
      provider: prov,
      base_url: meta.base_url || '',
      models: defaultModels.length ? defaultModels : prev.models,
    }));
    setAvailableModels(defaultModels);
    setTestResult(null);
  };

  const handleFetchModels = async () => {
    setLoadingModels(true);
    try {
      const res = await apiFetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.models?.length) {
          setAvailableModels(data.models);
          if (!settings.models?.length || !data.models.includes(settings.models[0])) {
            setSettings((prev) => ({ ...prev, models: [data.models[0]] }));
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveBanner(null);
    try {
      const res = await apiFetch('/api/ai/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        if (settings.provider === 'gemini' && settings.api_key && onGeminiKeySaved) {
          onGeminiKeySaved(settings.api_key);
        }
        setSaveBanner('AI Hub provider configuration saved! All clipping, dubbing, and AI Shorts jobs will now use this provider.');
        setTimeout(() => setSaveBanner(null), 4000);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handlePullOllama = async () => {
    if (!ollamaModelToPull.trim()) return;
    setPullingOllama(true);
    setPullResult(null);
    try {
      const res = await apiFetch('/api/ai/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModelToPull.trim(),
          base_url: settings.provider === 'ollama' ? settings.base_url : '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Pull failed');
      setPullResult({ ok: true, msg: `Successfully pulled ${data.model} (${data.status})!` });
      loadAll();
    } catch (e) {
      setPullResult({ ok: false, msg: e.message });
    } finally {
      setPullingOllama(false);
    }
  };

  const handleCheckCopyright = async () => {
    if (!ytCheckUrl.trim()) return;
    setCheckingCopyright(true);
    setCopyrightResult(null);
    try {
      const res = await apiFetch('/api/youtube/copyright-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ytCheckUrl.trim() }),
      });
      const data = await res.json();
      setCopyrightResult(data);
    } catch (e) {
      setCopyrightResult({ ok: false, error: e.message });
    } finally {
      setCheckingCopyright(false);
    }
  };

  const handleClearUsage = async () => {
    await apiFetch('/api/ai/usage/clear', { method: 'POST' });
    loadAll();
  };

  const currentProviderMeta = providers[settings.provider] || {};

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        <div>
          <p className="eyebrow mb-2">07 · MULTI-AI HUB & LOCAL ENGINE</p>
          <h1 className="font-display lowercase text-2xl text-ink">AI Provider Hub & Local Tools</h1>
          <p className="text-sm lowercase text-muted mt-1">
            Switch between 100% local Ollama, Offline Loudness Mode, Gemini, Groq, DeepSeek, OpenRouter, Claude, or OpenAI — plus YouTube Copyright Checker & Token Usage
          </p>
        </div>

        {saveBanner && (
          <div className="p-3.5 rounded-input bg-ok/10 border border-ok/30 text-ok text-xs flex items-center gap-2">
            <Check size={14} /> {saveBanner}
          </div>
        )}

        {/* SECTION 1: MULTI-AI PROVIDER CONFIG (PEAKCUT + AUTOSHORTS) */}
        <div className="card p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-medium text-ink lowercase flex items-center gap-2">
                <Cpu size={17} className="text-brass" /> Active AI Provider
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Used across Clip Scoring, Viral Hooks, AI Shorts Script Generation, Free Voice Translation, and Caption Word Fixing
              </p>
            </div>
            <span className="badge-ok">
              <Sparkles size={11} /> {currentProviderMeta.label || settings.provider}
            </span>
          </div>

          {/* Provider Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {Object.entries(providers).map(([key, meta]) => {
              const active = settings.provider === key;
              return (
                <button
                  key={key}
                  onClick={() => handleProviderChange(key)}
                  className={`p-3 rounded-input border text-left transition-colors ${
                    active ? 'border-brass bg-paper3' : 'border-rule bg-paper hover:bg-paper3'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-medium truncate ${active ? 'text-ink' : 'text-ink2'}`}>
                      {meta.label}
                    </span>
                    {active && <Check size={12} className="text-brass shrink-0" />}
                  </div>
                  <span className="readout block mt-1">
                    {!meta.needs_key ? 'no key needed' : 'api key'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Provider Inputs */}
          {settings.provider === 'loudness' ? (
            <div className="p-4 rounded-input bg-paper border border-rule text-xs text-ink2 space-y-1">
              <p className="font-medium text-ink">100% Offline Audio Loudness Mode Active (Ported from PeakCut)</p>
              <p className="text-muted">
                Picks high-energy viral clips using audio loudness z-score spikes and speech density — zero cloud AI calls, zero API keys, and zero tokens used.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {currentProviderMeta.needs_key && (
                <div>
                  <label className="eyebrow block mb-1.5">API Key</label>
                  <input
                    type="password"
                    value={settings.api_key || ''}
                    onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                    placeholder={`Enter ${currentProviderMeta.label || ''} API key...`}
                    className="input-field text-xs font-mono"
                  />
                </div>
              )}

              {(settings.provider === 'ollama' || settings.provider === 'custom' || currentProviderMeta.base_url) && (
                <div>
                  <label className="eyebrow block mb-1.5">Server Base URL</label>
                  <input
                    type="text"
                    value={settings.base_url || currentProviderMeta.base_url || ''}
                    onChange={(e) => setSettings({ ...settings, base_url: e.target.value })}
                    placeholder="http://localhost:11434/v1"
                    className="input-field text-xs font-mono"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="eyebrow">Model</label>
                  <button
                    onClick={handleFetchModels}
                    disabled={loadingModels}
                    className="text-[11px] lowercase text-muted hover:text-brass flex items-center gap-1"
                  >
                    <RefreshCw size={10} className={loadingModels ? 'animate-spin' : ''} /> fetch models
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    list="ai-hub-models-list"
                    value={(settings.models && settings.models[0]) || ''}
                    onChange={(e) => setSettings({ ...settings, models: [e.target.value] })}
                    placeholder="Model ID (e.g. llama3.1:8b)"
                    className="input-field text-xs font-mono"
                  />
                  <datalist id="ai-hub-models-list">
                    {availableModels.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
          )}

          {testResult && (
            <div className={`p-3 rounded-input border text-xs flex items-center gap-2 ${
              testResult.ok ? 'bg-ok/10 border-ok/30 text-ok' : 'bg-danger/10 border-danger/30 text-danger'
            }`}>
              {testResult.ok ? <Check size={14} /> : <AlertCircle size={14} />}
              <span>
                {testResult.ok
                  ? `Connected to ${testResult.provider} (${testResult.model}) in ${testResult.latency_ms} ms!`
                  : `Connection test failed: ${testResult.error}`}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-rule">
            <button onClick={handleTestConnection} disabled={testing} className="btn-ghost px-4 py-2 text-xs">
              <Zap size={13} /> {testing ? 'testing connection...' : 'test connection'}
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2 text-xs">
              <Check size={13} /> {saving ? 'saving...' : 'save ai hub configuration'}
            </button>
          </div>
        </div>

        {/* SECTION 2: LOCAL ENVIRONMENT STATUS & OLLAMA MODEL PULLER (AUTOSHORTS) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-ink lowercase flex items-center gap-2">
                <Server size={16} className="text-brass" /> Local Environment Status
              </h3>
              <button onClick={loadAll} className="text-xs text-muted hover:text-ink flex items-center gap-1">
                <RefreshCw size={12} /> re-check
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'ffmpeg', label: 'FFmpeg Video Engine' },
                { key: 'ffprobe', label: 'FFprobe Media Inspector' },
                { key: 'yt_dlp', label: 'yt-dlp Stream Extractor' },
                { key: 'faster_whisper', label: 'Faster-Whisper Local ASR' },
                { key: 'edge_tts', label: 'Edge-TTS Neural Voices' },
                { key: 'ollama_running', label: 'Ollama Local LLM Server' },
              ].map((item) => {
                const ok = envStatus?.[item.key];
                return (
                  <div key={item.key} className="p-3 rounded-input bg-paper border border-rule flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-ink">{item.label}</p>
                      <span className="readout">{ok ? 'installed & ready' : 'not detected'}</span>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ok ? 'bg-ok' : 'bg-warn'}`} />
                  </div>
                );
              })}
            </div>

            {/* One-Click Ollama Model Puller */}
            <div className="pt-3 border-t border-rule space-y-2.5">
              <label className="eyebrow block">One-Click Ollama Model Installer</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  list="ollama-presets"
                  value={ollamaModelToPull}
                  onChange={(e) => setOllamaModelToPull(e.target.value)}
                  placeholder="e.g. llama3.1:8b or qwen2.5:7b"
                  className="input-field text-xs font-mono flex-1"
                />
                <datalist id="ollama-presets">
                  {OLLAMA_PRESET_MODELS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <button
                  onClick={handlePullOllama}
                  disabled={pullingOllama || !ollamaModelToPull.trim()}
                  className="btn-primary px-4 py-2 text-xs shrink-0"
                >
                  <Download size={13} /> {pullingOllama ? 'pulling...' : 'pull model'}
                </button>
              </div>
              {pullResult && (
                <p className={`text-xs ${pullResult.ok ? 'text-ok' : 'text-danger'}`}>{pullResult.msg}</p>
              )}
            </div>
          </div>

          {/* YOUTUBE COPYRIGHT & CREATIVE COMMONS CHECKER (AUTOSHORTS) */}
          <div className="card p-6 space-y-4">
            <div>
              <h3 className="text-base font-medium text-ink lowercase flex items-center gap-2">
                <ShieldCheck size={16} className="text-brass" /> YouTube Copyright & Reuse License Checker
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Ported from AutoShorts — inspect any YouTube video before clipping to verify Creative Commons reuse rights, uploader attribution, and copyright risk.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={ytCheckUrl}
                onChange={(e) => setYtCheckUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckCopyright()}
                placeholder="https://www.youtube.com/watch?v=..."
                className="input-field text-xs flex-1"
              />
              <button
                onClick={handleCheckCopyright}
                disabled={checkingCopyright || !ytCheckUrl.trim()}
                className="btn-primary px-4 py-2 text-xs shrink-0"
              >
                <ShieldCheck size={13} /> {checkingCopyright ? 'checking...' : 'check license'}
              </button>
            </div>

            {copyrightResult && (
              <div className="p-4 rounded-input bg-paper border border-rule space-y-2 text-xs">
                {!copyrightResult.ok ? (
                  <p className="text-danger">{copyrightResult.error}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink truncate">{copyrightResult.title}</span>
                      <span className={copyrightResult.creative_commons ? 'badge-ok' : 'badge-warn'}>
                        {copyrightResult.risk_level === 'low' ? 'Creative Commons (Safe)' : 'Standard License'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-muted">
                      <span>Channel: <strong className="text-ink2">{copyrightResult.uploader}</strong></span>
                      <span>License: <strong className="text-ink2">{copyrightResult.license}</strong></span>
                    </div>
                    <p className="text-ink2 leading-relaxed pt-1 border-t border-rule">
                      {copyrightResult.summary}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: AI TOKEN & CALL USAGE DASHBOARD (PEAKCUT) */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-ink lowercase flex items-center gap-2">
                <Activity size={16} className="text-brass" /> AI Call & Token Usage Ledger
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Ported from PeakCut — real-time token and latency telemetry across all AI providers
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="readout">{usage.total_calls || 0} calls · {(usage.total_tokens || 0).toLocaleString()} tokens</span>
              {(usage.total_calls || 0) > 0 && (
                <button onClick={handleClearUsage} className="btn-ghost px-2.5 py-1 text-xs text-danger">
                  <Trash2 size={12} /> clear
                </button>
              )}
            </div>
          </div>

          {(usage.recent || []).length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">
              No AI calls recorded yet in this session.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-rule text-muted font-mono text-[11px] uppercase">
                    <th className="py-2 pr-3">Task</th>
                    <th className="py-2 pr-3">Provider</th>
                    <th className="py-2 pr-3">Model</th>
                    <th className="py-2 pr-3">Tokens</th>
                    <th className="py-2 pr-3">Latency</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {usage.recent.slice(0, 12).map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-3 text-ink">{row.purpose}</td>
                      <td className="py-2 pr-3 font-mono text-muted">{row.provider}</td>
                      <td className="py-2 pr-3 font-mono text-ink2">{row.model}</td>
                      <td className="py-2 pr-3 font-mono text-muted">{(row.total_tokens || 0).toLocaleString()}</td>
                      <td className="py-2 pr-3 font-mono text-muted">{row.ms} ms</td>
                      <td className="py-2">
                        <span className={row.ok ? 'text-ok' : 'text-danger'}>
                          {row.ok ? 'ok' : row.error || 'err'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
