import { useState, useEffect } from 'react';
import { Globe, Sparkles, Download, Copy, Check, ChevronRight, ChevronLeft, Loader2, AlertCircle, User, Film, Terminal, ChevronDown, RefreshCw, Share2, Calendar, Upload } from 'lucide-react';
import { getApiUrl } from '../config';
import { apiFetch } from '../lib/api';
import StepIndicator from './ui/StepIndicator';
import SegmentedControl from './ui/SegmentedControl';
import StarBanner from './StarBanner';

const STYLE_OPTIONS = [
  { id: 'ugc', label: 'UGC Natural', desc: 'Authentic, talking to camera' },
  { id: 'educational', label: 'Educational', desc: 'Clear explanations' },
  { id: 'shock', label: 'Shock/Discovery', desc: 'Surprising opener' },
  { id: 'story', label: 'Storytelling', desc: 'Mini narrative arc' },
  { id: 'comparison', label: 'Before/After', desc: 'Comparison style' },
];

const STEPS = ['Setup', 'Analysis', 'Configure', 'Generate', 'Result'];

const CACHE_KEY = 'saasshorts_cache';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (Date.now() - cache.timestamp > CACHE_MAX_AGE) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cache;
  } catch { return null; }
}

function saveCache(url, analysis, webResearch, scripts) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      url, analysis, webResearch, scripts, timestamp: Date.now(),
    }));
  } catch { /* ignore */ }
}

export default function SaaShortsTab({ geminiApiKey, uploadPostKey, uploadUserId }) {
  const geminiHeader = geminiApiKey ? { 'X-Gemini-Key': geminiApiKey } : {};
  const [step, setStep] = useState(() => {
    const cache = loadCache();
    return cache ? 1 : 0;
  });

  // Step 0: URL input
  const [url, setUrl] = useState(() => loadCache()?.url || '');
  const [videoMode, setVideoMode] = useState('lowcost');
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState('ugc');
  const [language, setLanguage] = useState('en');
  const [actorGender, setActorGender] = useState('female');
  const [numScripts, setNumScripts] = useState(3);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [fromCache, setFromCache] = useState(() => !!loadCache());

  // Step 1: Analysis results
  const [analysis, setAnalysis] = useState(() => loadCache()?.analysis || null);
  const [, setWebResearch] = useState(() => loadCache()?.webResearch || null);
  const [scripts, setScripts] = useState(() => loadCache()?.scripts || []);
  const [selectedScript, setSelectedScript] = useState(0);

  // Step 2: Configure
  const [shareToGallery, setShareToGallery] = useState(true);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('en-US-AriaNeural');
  const [actorDescription, setActorDescription] = useState('');
  const [editedNarration, setEditedNarration] = useState('');
  const [actorOptions, setActorOptions] = useState([]);
  const [selectedActor, setSelectedActor] = useState(null);
  const [generatingActors, setGeneratingActors] = useState(false);
  const [actorGallery, setActorGallery] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [uploadedActorPreview, setUploadedActorPreview] = useState(null);

  // Step 3: Generate
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [genLogs, setGenLogs] = useState([]);
  const [genStatus, setGenStatus] = useState('idle');
  const [genResult, setGenResult] = useState(null);

  // Publish
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [publishPlatforms, setPublishPlatforms] = useState({ tiktok: true, instagram: true, youtube: true });
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  // UI
  const [copied, setCopied] = useState('');
  const [logsExpanded, setLogsExpanded] = useState(true);

  useEffect(() => {
    if (fromCache && scripts.length > 0 && !actorDescription) {
      setActorDescription(scripts[0].actor_description || '');
      setEditedNarration(scripts[0].full_narration || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoadingGallery(true);
    apiFetch('/api/saasshorts/actor-gallery')
      .then(res => res.ok ? res.json() : { images: [] })
      .then(data => setActorGallery(data.images || []))
      .catch(() => {})
      .finally(() => setLoadingGallery(false));

    apiFetch('/api/saasshorts/voices')
      .then(res => res.ok ? res.json() : { voices: [] })
      .then(data => setVoices(data.voices || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const genderDefaults = {
      'en-female': 'en-US-AriaNeural',
      'en-male': 'en-US-ChristopherNeural',
      'es-female': 'es-ES-ElviraNeural',
      'es-male': 'es-MX-JorgeNeural',
    };
    const matchingVoice = voices.find(v => (v.labels?.gender || '').toLowerCase() === actorGender);
    if (matchingVoice) {
      setSelectedVoice(matchingVoice.voice_id);
    } else {
      setSelectedVoice(genderDefaults[`${language}-${actorGender}`] || genderDefaults['en-female']);
    }
  }, [actorGender, language, voices]);

  useEffect(() => {
    let interval;
    if (jobId && genStatus === 'processing') {
      interval = setInterval(async () => {
        try {
          const res = await apiFetch(`/api/saasshorts/status/${jobId}`);
          if (res.status === 404) {
            setGenStatus('failed');
            setGenerating(false);
            setGenLogs((prev) => [...prev, 'Job lost after server restart. Click Retry to resume.']);
            clearInterval(interval);
            return;
          }
          if (!res.ok) return;
          const data = await res.json();
          if (data.logs) setGenLogs(data.logs);
          if (data.status === 'completed') {
            setGenStatus('completed');
            setGenResult(data.result);
            setGenerating(false);
            setStep(4);
            clearInterval(interval);
          } else if (data.status === 'failed') {
            setGenStatus('failed');
            setGenerating(false);
            clearInterval(interval);
          }
        } catch (e) {
          console.error('Poll error:', e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [jobId, genStatus]);

  const handleAnalyze = async () => {
    if (!url.trim() && !description.trim()) return;
    setAnalyzing(true);
    setAnalyzeError('');

    try {
      const res = await apiFetch('/api/saasshorts/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...geminiHeader,
        },
        body: JSON.stringify({
          url: url.trim() || undefined,
          description: description.trim() || undefined,
          num_scripts: numScripts,
          style,
          language,
          actor_gender: actorGender,
        }),
      });

      if (!res.ok) {
        let msg = 'Analysis failed';
        try { const err = await res.json(); msg = err.detail?.message || err.detail || msg; } catch { msg = await res.text() || msg; }
        throw new Error(msg);
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      setWebResearch(data.web_research || null);
      setScripts(data.scripts || []);
      setSelectedScript(0);
      setFromCache(false);

      saveCache(url.trim(), data.analysis, data.web_research, data.scripts || []);

      if (data.scripts?.length > 0) {
        setActorDescription(data.scripts[0].actor_description || 'Friendly young creator speaking to camera in a modern studio');
        setEditedNarration(data.scripts[0].full_narration || '');
      }

      setStep(1);
    } catch (e) {
      setAnalyzeError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectScript = (idx) => {
    setSelectedScript(idx);
    if (scripts[idx]) {
      setActorDescription(scripts[idx].actor_description || '');
      setEditedNarration(scripts[idx].full_narration || '');
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenLogs(['🚀 Starting 100% Free AI Shorts generation ($0.00)...']);
    setGenStatus('processing');
    setGenResult(null);
    setStep(3);

    try {
      const scriptToSend = { ...scripts[selectedScript] };
      scriptToSend._product_name = analysis?.product_name || analysis?.name || '';
      scriptToSend._product_url = url;
      if (editedNarration && editedNarration !== scriptToSend.full_narration) {
        scriptToSend.full_narration = editedNarration;
      }

      const res = await apiFetch('/api/saasshorts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: scriptToSend,
          voice_id: selectedVoice,
          actor_description: actorDescription || undefined,
          selected_actor_url: selectedActor || undefined,
          video_mode: videoMode,
          share_to_gallery: shareToGallery,
        }),
      });

      if (!res.ok) {
        let msg = 'Generation failed';
        try { const err = await res.json(); msg = err.detail || msg; } catch { msg = await res.text() || msg; }
        throw new Error(msg);
      }

      const data = await res.json();
      setJobId(data.job_id);
    } catch (e) {
      setGenStatus('failed');
      setGenLogs((prev) => [...prev, `Error: ${e.message}`]);
      setGenerating(false);
    }
  };

  const handleRetry = async () => {
    if (!jobId) return;
    setGenerating(true);
    setGenLogs(['Retrying from cached assets...']);
    setGenStatus('processing');
    setGenResult(null);

    try {
      const scriptToSend = { ...scripts[selectedScript] };
      scriptToSend._product_name = analysis?.product_name || analysis?.name || '';
      scriptToSend._product_url = url;
      if (editedNarration && editedNarration !== scriptToSend.full_narration) {
        scriptToSend.full_narration = editedNarration;
      }

      const res = await apiFetch('/api/saasshorts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: scriptToSend,
          voice_id: selectedVoice,
          actor_description: actorDescription || undefined,
          retry_job_id: jobId,
          video_mode: videoMode,
          share_to_gallery: shareToGallery,
        }),
      });

      if (!res.ok) {
        let msg = 'Retry failed';
        try { const err = await res.json(); msg = err.detail || msg; } catch { msg = await res.text() || msg; }
        throw new Error(msg);
      }

      const data = await res.json();
      setJobId(data.job_id);
    } catch (e) {
      setGenStatus('failed');
      setGenLogs((prev) => [...prev, `Retry error: ${e.message}`]);
      setGenerating(false);
    }
  };

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleReset = () => {
    setStep(0);
    setUrl('');
    setAnalyzeError('');
    setAnalysis(null);
    setWebResearch(null);
    setScripts([]);
    setFromCache(false);
    localStorage.removeItem(CACHE_KEY);
    setSelectedScript(0);
    setJobId(null);
    setGenLogs([]);
    setGenStatus('idle');
    setGenResult(null);
    setGenerating(false);
    setActorDescription('');
    setEditedNarration('');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="eyebrow mb-2">03 · FREE AI SHORTS STUDIO</p>
            <h1 className="font-display lowercase text-2xl text-ink">AI Shorts</h1>
          </div>
          {step > 0 && (
            <button onClick={handleReset} className="text-xs lowercase text-muted hover:text-ink flex items-center gap-1 transition-colors">
              <RefreshCw size={12} /> Start over
            </button>
          )}
        </div>
        <p className="text-sm lowercase text-muted mb-6">
          Generate viral UGC & storyboard shorts for any product, website, or topic — 100% free ($0.00 cost, no paid API keys required)
        </p>

        <div className="mb-8">
          <StepIndicator steps={STEPS} current={step} />
        </div>

        {/* Step 0: URL Input */}
        {step === 0 && (
          <div className="animate-fade space-y-6">
            <div className="card p-4 sm:p-8 space-y-6">
              <div>
                <label className="eyebrow block mb-3">Visual Engine Mode</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setVideoMode('lowcost')}
                    className={`card card-hover p-4 text-left ${videoMode === 'lowcost' ? 'border-brass' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className={`text-sm font-medium lowercase ${videoMode === 'lowcost' ? 'text-ink' : 'text-ink2'}`}>UGC Presenter + B-Roll</span>
                      <span className="badge-ok">100% free</span>
                    </div>
                    <p className="readout mb-1.5">$0.00 / VIDEO</p>
                    <p className="text-xs text-muted leading-relaxed">Flux AI Presenter + Edge Neural TTS + Ken Burns B-Roll + TikTok Karaoke Captions.</p>
                  </button>
                  <button
                    onClick={() => setVideoMode('premium')}
                    className={`card card-hover p-4 text-left ${videoMode === 'premium' ? 'border-brass' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className={`text-sm font-medium lowercase ${videoMode === 'premium' ? 'text-ink' : 'text-ink2'}`}>Cinematic Multi-Scene</span>
                      <span className="badge-brass">100% free</span>
                    </div>
                    <p className="readout mb-1.5">$0.00 / VIDEO</p>
                    <p className="text-xs text-muted leading-relaxed">Full 5-part visual storyboard with dynamic zoom, neural voiceover, and burned captions.</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="eyebrow block mb-2">Website URL <span className="opacity-60">(optional)</span></label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://your-website.com"
                      className="input-field pl-10"
                      onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    />
                  </div>
                </div>
                <p className="text-xs lowercase text-muted mt-1.5">If provided, we&apos;ll scrape and analyze your site automatically</p>
              </div>

              <div>
                <label className="eyebrow block mb-2">
                  {url.trim() ? 'Extra context' : 'Describe your product, topic, or story'} <span className="opacity-60">{url.trim() ? '(optional)' : '(required if no URL)'}</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="input-field resize-none text-sm"
                  placeholder="e.g. open-source AI video clipper that runs locally, productivity app, fitness coaching..."
                />
              </div>

              <div>
                <label className="eyebrow block mb-3">Language</label>
                <div className="mb-6">
                  <SegmentedControl
                    options={[
                      { value: 'en', label: 'English', icon: '🇺🇸' },
                      { value: 'es', label: 'Español', icon: '🇪🇸' },
                    ]}
                    value={language}
                    onChange={setLanguage}
                  />
                </div>

                <label className="eyebrow block mb-3">Presenter Voice Gender</label>
                <div className="mb-6">
                  <SegmentedControl
                    options={[
                      { value: 'female', label: 'Woman', icon: '👩' },
                      { value: 'male', label: 'Man', icon: '👨' },
                    ]}
                    value={actorGender}
                    onChange={setActorGender}
                  />
                </div>

                <label className="eyebrow block mb-3">Video Style</label>
                <SegmentedControl
                  options={STYLE_OPTIONS.map((s) => ({ value: s.id, label: s.label, hint: s.desc }))}
                  value={style}
                  onChange={setStyle}
                  columns={5}
                />
              </div>

              <div>
                <label className="eyebrow block mb-3">Number of Scripts</label>
                <SegmentedControl
                  options={[1, 2, 3, 5].map((n) => ({ value: n, label: String(n) }))}
                  value={numScripts}
                  onChange={setNumScripts}
                  size="sm"
                />
              </div>

              {analyzeError && (
                <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-input p-3">
                  <AlertCircle size={14} />
                  {analyzeError}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={analyzing || (!url.trim() && !description.trim())}
                className="btn-primary w-full"
              >
                {analyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {url.trim() ? 'Scraping + analyzing + generating scripts...' : 'Generating viral scripts...'}
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="hidden sm:block" />
                    {url.trim() ? 'research & generate scripts' : 'generate scripts'}
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-4">
                <h3 className="eyebrow">Multi-AI Powered</h3>
                <p className="text-xs text-muted mt-2">Works with Gemini, local Ollama, Groq, DeepSeek, or OpenRouter via Clarity&apos;s AI Hub.</p>
              </div>
              <div className="card p-4">
                <h3 className="eyebrow">Free Neural TTS</h3>
                <p className="text-xs text-muted mt-2">Powered by Microsoft Edge Neural Voices with natural cadence and zero API keys required.</p>
              </div>
              <div className="card p-4">
                <h3 className="eyebrow">$0.00 Visuals</h3>
                <p className="text-xs text-muted mt-2">Generates AI portraits & B-Roll with Pollinations Flux + local HD fallback and TikTok ASS captions.</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Analysis Results */}
        {step === 1 && analysis && (
          <div className="animate-fade space-y-6">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4 gap-3">
                <h2 className="text-lg font-medium text-ink truncate">
                  {analysis.product_name || 'Analysis'}
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                  {fromCache && (
                    <span className="badge-warn">
                      cached
                      <button onClick={() => { setStep(0); setFromCache(false); }} className="hover:text-ink transition-colors ml-1" title="Re-analyze">
                        <RefreshCw size={9} />
                      </button>
                    </span>
                  )}
                  <span className="readout">{analysis.industry || 'SaaS / Product'}</span>
                </div>
              </div>
              <p className="text-sm text-ink2 mb-5">{analysis.one_liner || analysis.value_proposition || analysis.description}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="eyebrow mb-3">Pain Points</h3>
                  <div className="space-y-2">
                    {(analysis.pain_points || []).map((pp, i) => {
                      const label = typeof pp === 'string' ? pp : pp.pain;
                      const intensity = typeof pp === 'object' ? pp.intensity : 'high';
                      return (
                        <div key={i} className="flex items-start gap-2.5 text-sm">
                          <span className="mt-2 flex gap-0.5 shrink-0" title={intensity}>
                            {[0, 1, 2].map((d) => (
                              <span
                                key={d}
                                className={`w-1 h-1 rounded-full ${
                                  d < (intensity === 'high' ? 3 : intensity === 'medium' ? 2 : 1)
                                    ? 'bg-brass'
                                    : 'bg-[color:var(--color-rule-2)]'
                                }`}
                              />
                            ))}
                          </span>
                          <div>
                            <span className="text-ink2">{label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h3 className="eyebrow mb-3">Emotional Hooks & Features</h3>
                  <div className="divide-y divide-rule border-y border-rule">
                    {(analysis.emotional_hooks || analysis.key_features || []).map((h, i) => (
                      <div key={i} className="text-sm text-ink2 py-2">
                        {h}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display lowercase text-xl text-ink">Generated Scripts</h2>
                <span className="readout">{scripts.length} scripts</span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {scripts.map((script, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelectScript(i)}
                    className={`card card-hover p-5 cursor-pointer ${selectedScript === i ? 'border-brass' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full border flex items-center justify-center font-mono text-micro ${
                          selectedScript === i ? 'border-brass text-brass' : 'border-rule text-muted'
                        }`}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <h3 className="text-sm font-medium text-ink">{script.title}</h3>
                          <span className="readout">{script.duration_seconds || 30}s &middot; {script.style || style}</span>
                        </div>
                      </div>
                      {selectedScript === i && <span className="badge-brass">selected</span>}
                    </div>

                    <div className="space-y-2">
                      {(script.segments || []).map((seg, j) => (
                        <div key={j} className="flex gap-3 text-xs">
                          <span className="readout shrink-0 w-16 pt-px">{seg.type}</span>
                          <span className="text-ink2 leading-relaxed">{seg.narration}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 pt-3 border-t border-rule flex items-center gap-3 flex-wrap">
                      <span className="readout">hook</span>
                      <span className="text-xs text-ink2">&quot;{script.hook_text}&quot;</span>
                      {(script.hashtags || []).slice(0, 4).map((tag, j) => (
                        <span key={j} className="readout">{tag}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="btn-ghost px-4 py-2 text-sm">
                <ChevronLeft size={14} /> Back
              </button>
              <button onClick={() => setStep(2)} className="btn-primary px-6 py-2 text-sm">
                Configure video <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 2 && scripts[selectedScript] && (
          <div className="animate-fade space-y-6">
            <div className="card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display lowercase text-xl text-ink">Configure Video</h2>
                <span className="badge-ok">$0.00 · 100% Free</span>
              </div>
              <p className="text-sm lowercase text-muted">
                script: <strong className="text-ink2 normal-case font-medium">{scripts[selectedScript].title}</strong>
              </p>

              {/* Voice Selection */}
              <div>
                <label className="eyebrow block mb-2">
                  Free Neural Voice (Edge TTS)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {(voices.length > 0 ? voices : [
                    { voice_id: 'en-US-AriaNeural', name: 'Aria (US Female - Expressive)', labels: { gender: 'female', accent: 'american' } },
                    { voice_id: 'en-US-JennyNeural', name: 'Jenny (US Female - Friendly)', labels: { gender: 'female', accent: 'american' } },
                    { voice_id: 'en-US-ChristopherNeural', name: 'Christopher (US Male - Confident)', labels: { gender: 'male', accent: 'american' } },
                    { voice_id: 'en-US-GuyNeural', name: 'Guy (US Male - Energetic)', labels: { gender: 'male', accent: 'american' } },
                    { voice_id: 'es-ES-ElviraNeural', name: 'Elvira (ES Female)', labels: { gender: 'female', accent: 'spanish' } },
                    { voice_id: 'es-MX-JorgeNeural', name: 'Jorge (MX Male)', labels: { gender: 'male', accent: 'spanish' } },
                  ]).map((v) => (
                    <button
                      key={v.voice_id}
                      onClick={() => setSelectedVoice(v.voice_id)}
                      className={`flex items-center gap-3 p-2.5 rounded-input border text-left transition-colors ${
                        selectedVoice === v.voice_id
                          ? 'border-brass bg-paper3'
                          : 'border-rule bg-paper hover:bg-paper3'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm truncate ${selectedVoice === v.voice_id ? 'text-ink' : 'text-ink2'}`}>{v.name}</div>
                        <div className="readout mt-0.5">{v.labels?.accent || 'neural'} · {v.labels?.gender || ''}</div>
                      </div>
                      {selectedVoice === v.voice_id && <Check size={14} className="text-brass shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actor Selection */}
              <div>
                <label className="eyebrow block mb-2">
                  AI Presenter Portrait <span className="opacity-60">(optional — auto-generated if none selected)</span>
                </label>

                {actorGallery.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs lowercase text-muted mb-2">Previously generated presenters (click to select)</p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
                      {actorGallery.map((img, i) => (
                        <button
                          key={img.url}
                          onClick={() => setSelectedActor(getApiUrl(img.url))}
                          className={`relative rounded-input overflow-hidden border-2 transition-colors aspect-[3/4] ${
                            selectedActor === getApiUrl(img.url) || selectedActor === img.url ? 'border-brass' : 'border-rule hover:border-rule2'
                          }`}
                        >
                          <img src={getApiUrl(img.url)} alt={`Actor ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {loadingGallery && (
                  <p className="text-xs lowercase text-muted mb-3 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Loading presenter gallery...</p>
                )}

                <div className="mb-4">
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 text-sm lowercase text-muted px-4 py-3 rounded-input border border-dashed border-rule2 hover:border-brass hover:text-ink2 transition-colors cursor-pointer">
                      <Upload size={14} />
                      <span>Upload your own presenter photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const localPreview = URL.createObjectURL(file);
                          setUploadedActorPreview({ localPreview, serverUrl: null });
                          setSelectedActor(null);

                          const formData = new FormData();
                          formData.append('file', file);
                          try {
                            const res = await apiFetch('/api/saasshorts/actor-upload', {
                              method: 'POST',
                              body: formData,
                            });
                            if (res.ok) {
                              const data = await res.json();
                              if (data.url) {
                                setUploadedActorPreview({ localPreview, serverUrl: data.url });
                                setSelectedActor(data.url);
                              }
                            }
                          } catch (err) { console.error('Upload failed:', err); }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {uploadedActorPreview && (
                      <button
                        onClick={() => {
                          if (uploadedActorPreview.serverUrl) setSelectedActor(uploadedActorPreview.serverUrl);
                        }}
                        className={`relative w-16 h-20 rounded-input overflow-hidden border-2 flex-shrink-0 ${
                          selectedActor === uploadedActorPreview.serverUrl ? 'border-brass' : 'border-rule'
                        }`}
                      >
                        <img src={uploadedActorPreview.localPreview} alt="Uploaded" className="w-full h-full object-cover" />
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  value={actorDescription}
                  onChange={(e) => { setActorDescription(e.target.value); setActorOptions([]); }}
                  rows={2}
                  className="input-field resize-none text-sm"
                  placeholder="Describe your presenter (e.g. Young female creator in a cozy modern studio)..."
                />

                <button
                  onClick={async () => {
                    if (!actorDescription) return;
                    setGeneratingActors(true);
                    setActorOptions([]);
                    try {
                      const res = await apiFetch('/api/saasshorts/actor-options', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ actor_description: actorDescription, num_options: 3 }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        const imgs = data.images || [];
                        setActorOptions(imgs);
                        if (imgs.length > 0) setSelectedActor(imgs[0]);
                      }
                    } catch (e) { console.error(e); }
                    finally { setGeneratingActors(false); }
                  }}
                  disabled={generatingActors || !actorDescription}
                  className="btn-ghost mt-2 w-full py-2.5 text-sm"
                >
                  {generatingActors ? (
                    <><Loader2 size={14} className="animate-spin" /> Generating 3 free presenter portraits...</>
                  ) : (
                    <><User size={14} /> {actorOptions.length > 0 ? 'Regenerate presenters' : 'Preview 3 AI presenter portraits'} <span className="readout">$0.00 FREE</span></>
                  )}
                </button>

                {actorOptions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs lowercase text-muted mb-2">Generated presenters (select one)</p>
                    <div className="grid grid-cols-3 gap-3">
                      {actorOptions.map((imgUrl, i) => (
                        <button
                          key={imgUrl}
                          onClick={() => setSelectedActor(imgUrl)}
                          className={`relative rounded-card overflow-hidden border-2 transition-colors aspect-[9/16] ${
                            selectedActor === imgUrl ? 'border-brass' : 'border-rule hover:border-rule2'
                          }`}
                        >
                          <img src={getApiUrl(imgUrl)} alt={`New ${i + 1}`} className="w-full h-full object-cover" />
                          {selectedActor === imgUrl && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-brass rounded-full flex items-center justify-center">
                              <Check size={12} className="text-brassink" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Narration Edit */}
              <div>
                <label className="eyebrow block mb-2">Narration Script</label>
                <textarea
                  value={editedNarration}
                  onChange={(e) => setEditedNarration(e.target.value)}
                  rows={5}
                  className="input-field resize-none font-mono text-xs"
                />
                <p className="readout mt-1.5">{editedNarration.length} chars &middot; ~{Math.round(editedNarration.split(' ').length / 2.5)}s speech</p>
              </div>

              <label className="flex items-start gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={shareToGallery}
                  onChange={(e) => setShareToGallery(e.target.checked)}
                  className="mt-0.5 accent-brass"
                />
                <span>
                  Save this video to your local AI Shorts Gallery
                  <span className="block text-xs text-muted">
                    Accessible anytime from the Gallery tab
                  </span>
                </span>
              </label>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="btn-ghost px-4 py-2 text-sm">
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary px-6 py-2 text-sm"
              >
                {generating ? (
                  <><Loader2 size={14} className="animate-spin" /> Generating...</>
                ) : (
                  <><Film size={14} /> Generate video ($0.00 Free)</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Generation Progress */}
        {step === 3 && (
          <div className="animate-fade space-y-6">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display lowercase text-xl text-ink">Video Generation</h2>
                <span className={
                  genStatus === 'processing' ? 'badge-brass' :
                  genStatus === 'completed' ? 'badge-ok' :
                  'badge-danger'
                }>
                  {genStatus.toUpperCase()}
                </span>
              </div>

              <div className="border-y border-rule divide-y divide-rule mb-4">
                {[
                  'Generating presenter portrait + Edge Neural voiceover',
                  'Animating presenter segment with breathing zoom',
                  'Generating & animating B-roll scenes',
                  'Compositing final 9:16 vertical short + TikTok captions',
                ].map((label, i) => {
                  const logStr = genLogs.join(' ').toLowerCase();
                  const stepDone =
                    i === 0 ? logStr.includes('[2/5]') || logStr.includes('[3/5]') :
                    i === 1 ? logStr.includes('[3/5]') || logStr.includes('[4/5]') :
                    i === 2 ? logStr.includes('[4/5]') || logStr.includes('[5/5]') :
                    genStatus === 'completed';
                  const stepActive =
                    i === 0 ? logStr.includes('[1/5]') && !stepDone :
                    i === 1 ? logStr.includes('[2/5]') && !stepDone :
                    i === 2 ? logStr.includes('[3/5]') && !stepDone :
                    (logStr.includes('[4/5]') || logStr.includes('[5/5]')) && genStatus !== 'completed';

                  return (
                    <div key={i} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="font-mono text-micro text-muted w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      {stepDone ? (
                        <Check size={14} className="text-ok shrink-0" />
                      ) : stepActive ? (
                        <Loader2 size={14} className="text-brass animate-spin shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-rule shrink-0" />
                      )}
                      <span className={`lowercase ${stepDone ? 'text-muted' : stepActive ? 'text-ink' : 'text-muted/60'}`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="bg-paper rounded-card border border-rule overflow-hidden">
                <div className="px-4 py-2 border-b border-rule flex items-center justify-between">
                  <span className="readout flex items-center gap-2">
                    <Terminal size={12} /> Generation Logs
                  </span>
                  <button onClick={() => setLogsExpanded(!logsExpanded)} className="text-muted hover:text-ink transition-colors">
                    <ChevronDown size={14} className={logsExpanded ? '' : 'rotate-180'} />
                  </button>
                </div>
                {logsExpanded && (
                  <div className="p-4 max-h-64 overflow-y-auto font-mono text-xs space-y-1 custom-scrollbar">
                    {genLogs.map((log, i) => (
                      <div key={i} className={`${log.toLowerCase().includes('error') ? 'text-danger' : log.includes('✅') ? 'text-ok' : 'text-muted'}`}>
                        {log}
                      </div>
                    ))}
                    {genStatus === 'processing' && (
                      <div className="animate-pulse text-brass">_</div>
                    )}
                  </div>
                )}
              </div>

              {genStatus === 'failed' && (
                <div className="mt-4 p-4 bg-danger/10 rounded-card space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-danger shrink-0" />
                    <span className="text-sm text-danger">Generation failed. You can retry or go back to change settings.</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setStep(2); setGenStatus('idle'); setGenerating(false); }}
                      className="btn-quiet px-4 py-2 text-sm"
                    >
                      <ChevronLeft size={14} /> Change voice/settings
                    </button>
                    <button
                      onClick={handleRetry}
                      disabled={generating}
                      className="btn-ghost px-4 py-2 text-sm"
                    >
                      <RefreshCw size={14} /> Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && genResult && (
          <div className="animate-fade space-y-6">
            <div className="card p-6">
              <h2 className="font-display lowercase text-xl text-ink mb-4">
                Your Short is Ready
              </h2>

              <div className="mb-4">
                <StarBanner message="Happy with your short?" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card aspect-[9/16] max-h-[500px] bg-black overflow-hidden relative">
                  <video
                    src={getApiUrl(genResult.video_url)}
                    controls
                    className="w-full h-full object-contain"
                    autoPlay
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-ink mb-1">{genResult.script?.title}</h3>
                    <p className="readout">{genResult.duration?.toFixed?.(1) || genResult.duration}s &middot; 9:16 vertical &middot; $0.00 free</p>
                  </div>

                  {genResult.script?.caption && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="eyebrow">Caption</span>
                        <button
                          onClick={() => handleCopy(genResult.script.caption, 'caption')}
                          className="text-xs lowercase text-muted hover:text-brass flex items-center gap-1 transition-colors"
                        >
                          {copied === 'caption' ? <Check size={10} className="text-ok" /> : <Copy size={10} />}
                          {copied === 'caption' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-xs text-ink2 bg-paper border border-rule rounded-input p-2.5">{genResult.script.caption}</p>
                    </div>
                  )}

                  {genResult.script?.hashtags && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="eyebrow">Hashtags</span>
                        <button
                          onClick={() => handleCopy(genResult.script.hashtags.join(' '), 'hashtags')}
                          className="text-xs lowercase text-muted hover:text-brass flex items-center gap-1 transition-colors"
                        >
                          {copied === 'hashtags' ? <Check size={10} className="text-ok" /> : <Copy size={10} />}
                          {copied === 'hashtags' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {genResult.script.hashtags.map((tag, i) => (
                          <span key={i} className="readout bg-paper3 px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <a
                      href={getApiUrl(genResult.video_url)}
                      download
                      className="btn-primary px-4 py-2 text-sm"
                    >
                      <Download size={14} /> Download
                    </a>
                    <button
                      onClick={handleReset}
                      className="btn-ghost px-4 py-2 text-sm"
                    >
                      <RefreshCw size={14} /> New video
                    </button>
                  </div>

                  {uploadPostKey && (
                    <div className="card p-4 space-y-3 mt-2">
                      <h3 className="eyebrow">Publish to Social Media</h3>
                      <SegmentedControl
                        multi
                        size="sm"
                        options={[
                          { value: 'tiktok', label: 'TikTok' },
                          { value: 'instagram', label: 'Instagram' },
                          { value: 'youtube', label: 'YouTube' },
                        ]}
                        value={Object.keys(publishPlatforms).filter((k) => publishPlatforms[k])}
                        onChange={(arr) => setPublishPlatforms({
                          tiktok: arr.includes('tiktok'),
                          instagram: arr.includes('instagram'),
                          youtube: arr.includes('youtube'),
                        })}
                      />
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs lowercase text-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isScheduling}
                            onChange={(e) => setIsScheduling(e.target.checked)}
                            className="w-3.5 h-3.5 rounded accent-brass"
                          />
                          <Calendar size={12} /> Schedule
                        </label>
                        {isScheduling && (
                          <input
                            type="datetime-local"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="input-field text-xs py-1 px-2 w-auto"
                          />
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          const selected = Object.keys(publishPlatforms).filter(k => publishPlatforms[k]);
                          if (selected.length === 0) return;
                          setPublishing(true);
                          setPublishResult(null);
                          try {
                            const res = await apiFetch('/api/saasshorts/post', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                job_id: jobId,
                                api_key: uploadPostKey,
                                user_id: uploadUserId,
                                platforms: selected,
                                title: genResult.script?.title,
                                description: genResult.script?.caption || genResult.script?.full_narration,
                              }),
                            });
                            if (!res.ok) throw new Error('Publish failed');
                            setPublishResult({ ok: true, msg: 'Published!' });
                          } catch (e) {
                            setPublishResult({ ok: false, msg: e.message });
                          } finally {
                            setPublishing(false);
                          }
                        }}
                        disabled={publishing}
                        className="btn-primary w-full py-2 text-sm"
                      >
                        <Share2 size={14} /> {publishing ? 'Publishing...' : 'Publish now'}
                      </button>
                      {publishResult && (
                        <p className={`text-xs ${publishResult.ok ? 'text-ok' : 'text-danger'}`}>{publishResult.msg}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
