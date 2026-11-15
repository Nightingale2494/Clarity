import React, { useState, useEffect } from 'react';
import { Film, Download, Sparkles, RefreshCw, Play, Copy, Check } from 'lucide-react';
import { getApiUrl } from '../config';
import { apiFetch } from '../lib/api';

export default function UGCGallery({ onOpenCreator }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  const loadGallery = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/saasshorts/gallery');
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGallery();
  }, []);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text || '');
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="eyebrow mb-2">04 · AI SHORTS GALLERY</p>
            <h1 className="font-display lowercase text-2xl text-ink">AI Shorts Gallery</h1>
            <p className="text-sm lowercase text-muted mt-1">
              Browse, replay, and download all AI Shorts & UGC videos generated on your machine
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadGallery} className="btn-ghost px-3 py-2 text-xs">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> refresh
            </button>
            {onOpenCreator && (
              <button onClick={onOpenCreator} className="btn-primary px-4 py-2 text-xs">
                <Sparkles size={13} /> create new ai short
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="card p-12 text-center text-muted text-sm lowercase">
            Loading AI Shorts gallery...
          </div>
        ) : videos.length === 0 ? (
          <div className="card p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-paper3 flex items-center justify-center mx-auto">
              <Film size={20} className="text-brass" />
            </div>
            <div>
              <h3 className="text-base font-medium text-ink lowercase">No AI Shorts generated yet</h3>
              <p className="text-xs text-muted mt-1 max-w-md mx-auto">
                Create 100% free viral UGC & storyboard shorts with Edge Neural TTS, Flux AI visuals, and TikTok karaoke captions.
              </p>
            </div>
            {onOpenCreator && (
              <button onClick={onOpenCreator} className="btn-primary px-5 py-2.5 text-xs mx-auto">
                <Play size={13} /> launch ai shorts creator
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((v) => (
              <div key={v.job_id || v.id} className="card overflow-hidden flex flex-col">
                <div className="aspect-[9/16] bg-black relative">
                  <video
                    src={getApiUrl(v.video_url)}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute top-3 left-3 bg-black/75 text-ink font-mono text-micro uppercase px-2 py-0.5 rounded-full">
                    {v.style || 'ugc'}
                  </span>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-ink line-clamp-1">{v.title || 'AI Short'}</h3>
                    {v.hook_text && (
                      <p className="text-xs text-muted mt-1 line-clamp-2">&ldquo;{v.hook_text}&rdquo;</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-rule">
                    {v.caption && (
                      <button
                        onClick={() => handleCopy(v.id, v.caption)}
                        className="btn-ghost px-2.5 py-1.5 text-xs flex-1"
                      >
                        {copiedId === v.id ? <Check size={12} className="text-ok" /> : <Copy size={12} />}
                        {copiedId === v.id ? 'copied' : 'copy caption'}
                      </button>
                    )}
                    <a
                      href={getApiUrl(v.video_url)}
                      download
                      className="btn-primary px-3 py-1.5 text-xs flex-1 text-center"
                    >
                      <Download size={12} /> download
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
