import React, { useEffect, useState } from 'react';
import { Scissors } from 'lucide-react';
import { apiFetch } from '../lib/api';

const fmt = (sec) => {
    const s = Math.max(0, Math.round(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
};

const parseMmSs = (str) => {
    const parts = String(str || '').trim().split(':').map((p) => Number(p));
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
};

export default function SourceCost({ mode, url, fileSeconds, range, onRangeChange }) {
    const [probe, setProbe] = useState(null); // {duration_seconds, title} | null

    useEffect(() => {
        onRangeChange(null);
        setProbe(null);
        if (mode !== 'url') return undefined;
        const trimmed = (url || '').trim();
        if (!/^https?:\/\/\S+\.\S+/i.test(trimmed)) return undefined;
        let cancelled = false;
        const t = setTimeout(() => {
            apiFetch(`/api/source/probe?url=${encodeURIComponent(trimmed)}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => { if (!cancelled && d && d.duration_seconds) setProbe(d); })
                .catch(() => {});
        }, 450);
        return () => { cancelled = true; clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, url]);

    useEffect(() => {
        onRangeChange(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileSeconds]);

    const totalSec = mode === 'file' ? fileSeconds : probe?.duration_seconds;
    if (!totalSec || totalSec < 45) return null;

    const start = range ? range.start : 0;
    const end = range ? range.end : totalSec;
    const pickedSec = Math.max(0, end - start);

    const openPicker = () => {
        onRangeChange({ start: 0, end: totalSec });
    };

    const setBounds = (nextStart, nextEnd) => {
        const s = Math.max(0, Math.min(totalSec - 45, Math.round(nextStart)));
        const e = Math.min(totalSec, Math.max(s + 45, Math.round(nextEnd)));
        onRangeChange({ start: s, end: e });
    };

    return (
        <div className="mt-3 px-3.5 py-2.5 rounded-input border border-rule bg-paper2 text-xs text-muted space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                    {probe?.title ? <span className="text-ink2 font-medium">{probe.title} · </span> : null}
                    <span className="font-mono text-ink2">{fmt(pickedSec)}</span>
                    {range ? <span> of {fmt(totalSec)}</span> : null}
                </span>
                {!range && totalSec > 90 && (
                    <button
                        type="button"
                        onClick={openPicker}
                        className="inline-flex items-center gap-1 text-brass hover:underline lowercase"
                    >
                        <Scissors size={12} /> clip only part of it
                    </button>
                )}
                {range && (
                    <button
                        type="button"
                        onClick={() => onRangeChange(null)}
                        className="text-muted hover:text-ink2 underline lowercase"
                    >
                        use full video ({fmt(totalSec)})
                    </button>
                )}
            </div>

            {range && (
                <RangeRow
                    totalSec={totalSec}
                    start={start}
                    end={end}
                    onChange={setBounds}
                />
            )}
        </div>
    );
}

function RangeRow({ totalSec, start, end, onChange }) {
    const [fromStr, setFromStr] = useState(fmt(start));
    const [toStr, setToStr] = useState(fmt(end));
    useEffect(() => { setFromStr(fmt(start)); }, [start]);
    useEffect(() => { setToStr(fmt(end)); }, [end]);

    const commitFrom = () => {
        const v = parseMmSs(fromStr);
        if (v == null) { setFromStr(fmt(start)); return; }
        onChange(v, end);
    };
    const commitTo = () => {
        const v = parseMmSs(toStr);
        if (v == null) { setToStr(fmt(end)); return; }
        onChange(start, v);
    };

    const pctStart = (start / totalSec) * 100;
    const pctWidth = ((end - start) / totalSec) * 100;

    return (
        <div className="pt-1 space-y-2">
            <div className="relative h-2 rounded-full bg-paper3 overflow-hidden">
                <div
                    className="absolute top-0 bottom-0 bg-brass/60"
                    style={{ left: `${pctStart}%`, width: `${pctWidth}%` }}
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                    <span className="eyebrow">from</span>
                    <input
                        type="text"
                        value={fromStr}
                        onChange={(e) => setFromStr(e.target.value)}
                        onBlur={commitFrom}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitFrom(); } }}
                        className="input-field !py-1 !px-2 font-mono text-xs w-24"
                        aria-label="Start time"
                    />
                    <input
                        type="range"
                        min={0}
                        max={Math.max(0, totalSec - 45)}
                        step={15}
                        value={start}
                        onChange={(e) => onChange(Number(e.target.value), end)}
                        className="flex-1 accent-[var(--color-accent)]"
                        aria-label="Start time slider"
                    />
                </label>
                <label className="flex items-center gap-2">
                    <span className="eyebrow">to</span>
                    <input
                        type="text"
                        value={toStr}
                        onChange={(e) => setToStr(e.target.value)}
                        onBlur={commitTo}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTo(); } }}
                        className="input-field !py-1 !px-2 font-mono text-xs w-24"
                        aria-label="End time"
                    />
                    <input
                        type="range"
                        min={45}
                        max={totalSec}
                        step={15}
                        value={end}
                        onChange={(e) => onChange(start, Number(e.target.value))}
                        className="flex-1 accent-[var(--color-accent)]"
                        aria-label="End time slider"
                    />
                </label>
            </div>
        </div>
    );
}
