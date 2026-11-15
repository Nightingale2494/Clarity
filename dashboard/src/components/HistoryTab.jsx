import React, { useState, useEffect } from 'react';
import { FolderOpen, Film, Trash2, Edit3, Check, X, Download, ExternalLink, RefreshCw, Search, Play, Copy } from 'lucide-react';
import { getApiUrl } from '../config';
import { apiFetch } from '../lib/api';

export default function HistoryTab({ onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('projects'); // 'projects' | 'clips'
  const [searchQuery, setSearchQuery] = useState('');
  const [editingJobId, setEditingJobId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setClips(data.clips || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleRename = async (jobId) => {
    if (!editTitle.trim()) return;
    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(jobId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      if (res.ok) {
        setEditingJobId(null);
        loadHistory();
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (jobId, title) => {
    if (!window.confirm(`Delete project "${title}" and all its local clips?`)) return;
    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadHistory();
      }
    } catch {
      // ignore
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text || '');
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredProjects = q
    ? projects.filter((p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.clips || []).some((c) => (c.title || '').toLowerCase().includes(q))
      )
    : projects;
  const filteredClips = q
    ? clips.filter((c) =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.project_title || '').toLowerCase().includes(q) ||
        (c.viral_hook_text || '').toLowerCase().includes(q)
      )
    : clips;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="eyebrow mb-2">05 · LOCAL PROJECT & CLIP LIBRARY</p>
            <h1 className="font-display lowercase text-2xl text-ink">Local Projects & History</h1>
            <p className="text-sm lowercase text-muted mt-1">
              100% local disk library — browse, rename, reopen in Clip Generator, or download your rendered clips
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-input border border-rule overflow-hidden">
              <button
                onClick={() => setViewMode('projects')}
                className={`px-3 py-1.5 text-xs lowercase flex items-center gap-1.5 transition-colors ${
                  viewMode === 'projects' ? 'bg-ink text-paper' : 'bg-paper2 text-muted hover:text-ink'
                }`}
              >
                <FolderOpen size={13} /> projects ({projects.length})
              </button>
              <button
                onClick={() => setViewMode('clips')}
                className={`px-3 py-1.5 text-xs lowercase flex items-center gap-1.5 transition-colors ${
                  viewMode === 'clips' ? 'bg-ink text-paper' : 'bg-paper2 text-muted hover:text-ink'
                }`}
              >
                <Film size={13} /> all clips ({clips.length})
              </button>
            </div>
            <button onClick={loadHistory} className="btn-ghost px-3 py-1.5 text-xs">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> refresh
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects, clip titles, or viral hooks..."
            className="input-field pl-10 text-sm"
          />
        </div>

        {loading ? (
          <div className="card p-12 text-center text-muted text-sm lowercase">
            Scanning local outputs directory...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="card p-12 text-center space-y-3">
            <FolderOpen size={24} className="text-brass mx-auto" />
            <h3 className="text-base font-medium text-ink lowercase">No local projects found yet</h3>
            <p className="text-xs text-muted max-w-md mx-auto">
              Every video you clip is automatically saved in your local outputs folder and appears here for instant reopening, renaming, or dubbing.
            </p>
          </div>
        ) : viewMode === 'projects' ? (
          <div className="space-y-6">
            {filteredProjects.map((project) => (
              <div key={project.job_id} className="card p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <FolderOpen size={18} className="text-brass shrink-0" />
                    {editingJobId === project.job_id ? (
                      <div className="flex items-center gap-2 flex-1 max-w-md">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRename(project.job_id)}
                          className="input-field py-1 px-2.5 text-sm"
                          autoFocus
                        />
                        <button onClick={() => handleRename(project.job_id)} className="p-1.5 text-ok hover:bg-paper3 rounded">
                          <Check size={15} />
                        </button>
                        <button onClick={() => setEditingJobId(null)} className="p-1.5 text-muted hover:bg-paper3 rounded">
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <h2 className="text-base font-medium text-ink truncate">{project.title}</h2>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="readout">{project.clip_count} clips</span>
                          <span className="readout">&middot;</span>
                          <span className="readout">{new Date(project.created_at).toLocaleString()}</span>
                          <span className="readout">&middot;</span>
                          <span className="readout">id: {project.job_id.slice(0, 8)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {onOpenProject && (
                      <button
                        onClick={() => onOpenProject(project.job_id)}
                        className="btn-primary px-3 py-1.5 text-xs"
                        title="Reopen project in Clip Generator with full editor & dubbing tools"
                      >
                        <Play size={12} /> open in editor
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingJobId(project.job_id);
                        setEditTitle(project.title);
                      }}
                      className="btn-ghost px-2.5 py-1.5 text-xs"
                      title="Rename project"
                    >
                      <Edit3 size={13} /> rename
                    </button>
                    <button
                      onClick={() => handleDelete(project.job_id, project.title)}
                      className="btn-ghost px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10"
                      title="Delete project"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Clips Grid inside Project */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(project.clips || []).map((c) => (
                    <div key={`${project.job_id}_${c.clip_index}`} className="bg-paper rounded-input border border-rule overflow-hidden flex flex-col">
                      <div className="aspect-[9/16] bg-black relative">
                        <video
                          src={getApiUrl(c.video_url)}
                          controls
                          playsInline
                          className="w-full h-full object-contain"
                        />
                        <span className="absolute top-2 left-2 bg-black/75 text-ink font-mono text-micro px-2 py-0.5 rounded-full">
                          #{c.clip_index + 1} · {c.duration}s
                        </span>
                      </div>
                      <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-ink line-clamp-2">{c.title}</p>
                          {c.viral_hook_text && (
                            <p className="text-[11px] text-muted mt-1 line-clamp-1">🪝 {c.viral_hook_text}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 pt-2 border-t border-rule">
                          <button
                            onClick={() => handleCopy(`${project.job_id}_${c.clip_index}`, c.title)}
                            className="btn-ghost py-1 px-2 text-[11px] flex-1"
                          >
                            {copiedId === `${project.job_id}_${c.clip_index}` ? <Check size={11} className="text-ok" /> : <Copy size={11} />}
                            copy
                          </button>
                          <a
                            href={getApiUrl(c.video_url)}
                            download
                            className="btn-primary py-1 px-2 text-[11px] flex-1 text-center"
                          >
                            <Download size={11} /> save
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {filteredClips.map((c) => (
              <div key={`${c.job_id}_${c.clip_index}`} className="card overflow-hidden flex flex-col">
                <div className="aspect-[9/16] bg-black relative">
                  <video
                    src={getApiUrl(c.video_url)}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute top-2 left-2 bg-black/75 text-ink font-mono text-micro px-2 py-0.5 rounded-full">
                    {c.duration}s
                  </span>
                </div>
                <div className="p-3.5 flex-1 flex flex-col justify-between gap-2">
                  <div>
                    <span className="readout block mb-1 truncate">{c.project_title}</span>
                    <p className="text-xs font-medium text-ink line-clamp-2">{c.title}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-rule">
                    {onOpenProject && (
                      <button
                        onClick={() => onOpenProject(c.job_id)}
                        className="btn-ghost py-1.5 px-2.5 text-xs flex-1"
                      >
                        <ExternalLink size={11} /> edit
                      </button>
                    )}
                    <a
                      href={getApiUrl(c.video_url)}
                      download
                      className="btn-primary py-1.5 px-2.5 text-xs flex-1 text-center"
                    >
                      <Download size={11} /> download
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
