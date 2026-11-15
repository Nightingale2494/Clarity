import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Sparkles } from 'lucide-react';
import { getApiUrl } from '../config';

const TABS = [
    { id: 'claude', label: 'claude.ai' },
    { id: 'chatgpt', label: 'chatgpt' },
    { id: 'desktop', label: 'claude desktop / cursor' },
    { id: 'code', label: 'claude code' },
    { id: 'cli', label: 'cli' },
];

export default function McpConnectCard() {
    const [tab, setTab] = useState('claude');
    const [copied, setCopied] = useState(null);

    const mcpUrl = getApiUrl('/mcp') || `${window.location.origin}/mcp`;

    const desktopJson = JSON.stringify({
        mcpServers: {
            clarity: {
                url: mcpUrl,
            },
        },
    }, null, 2);

    const claudeCodeCmd = `claude mcp add --transport http clarity ${mcpUrl}`;

    const cliCmd = [
        'pip install ./cli',
        'clarity clip "https://www.youtube.com/watch?v=..." --wait --download ./clips',
    ].join('\n');

    const copy = async (text, which) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(which);
            setTimeout(() => setCopied((c) => (c === which ? null : c)), 1500);
        } catch { /* ignore */ }
    };

    const CopyBox = ({ text, id }) => (
        <div className="flex items-start gap-2">
            <pre className="flex-1 bg-paper rounded-input px-3 py-2 font-mono text-xs text-ink border border-rule overflow-x-auto select-all whitespace-pre-wrap break-all">
                {text}
            </pre>
            <button
                type="button"
                onClick={() => copy(text, id)}
                className="btn-ghost shrink-0"
                title="Copy"
            >
                {copied === id ? <Check size={14} /> : <Copy size={14} />}
                {copied === id ? 'copied' : 'copy'}
            </button>
        </div>
    );

    return (
        <section className="card p-6 mb-5">
            <div className="flex items-center justify-between gap-3 mb-2">
                <span className="eyebrow flex items-center gap-1.5">
                    <Sparkles size={12} /> CONNECT AN AI AGENT · MCP
                </span>
                <a
                    href="/mcp"
                    className="inline-flex items-center gap-1 text-xs lowercase text-brass hover:underline"
                >
                    full guide <ExternalLink size={11} />
                </a>
            </div>
            <p className="text-xs text-muted mb-4">
                Let Claude, ChatGPT or Cursor clip videos and publish to your socials from a conversation.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-4 border-b border-rule pb-3">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={
                            tab === t.id
                                ? 'px-2.5 py-1 rounded-input text-xs lowercase bg-brass text-paper font-medium'
                                : 'px-2.5 py-1 rounded-input text-xs lowercase text-muted hover:text-ink border border-rule'
                        }
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'claude' && (
                <div className="space-y-3 text-xs text-ink2">
                    <ol className="list-decimal pl-5 space-y-1.5">
                        <li>In <strong className="text-ink">claude.ai</strong>, open <strong className="text-ink">Settings &rarr; Connectors &rarr; Add custom connector</strong>.</li>
                        <li>Name it <code className="font-mono text-ink">Clarity</code> and paste this URL (has to be reachable from the internet &mdash; use a tunnel like <code className="font-mono text-ink">cloudflared</code> if running locally):</li>
                    </ol>
                    <CopyBox text={mcpUrl} id="claude-url" />
                    <p className="text-muted">
                        Then ask Claude: <em className="text-ink2">&ldquo;clip this YouTube video with Clarity: https://&hellip;&rdquo;</em> &mdash; an interactive clip picker renders inline in the chat.
                    </p>
                </div>
            )}

            {tab === 'chatgpt' && (
                <div className="space-y-3 text-xs text-ink2">
                    <ol className="list-decimal pl-5 space-y-1.5">
                        <li>In <strong className="text-ink">ChatGPT</strong>, open <strong className="text-ink">Settings &rarr; Connectors &rarr; Create</strong> (enable Developer Mode under Advanced if you don&rsquo;t see Create).</li>
                        <li>Paste the MCP server URL:</li>
                    </ol>
                    <CopyBox text={mcpUrl} id="chatgpt-url" />
                </div>
            )}

            {tab === 'desktop' && (
                <div className="space-y-3 text-xs text-ink2">
                    <p className="text-muted">
                        Add to <code className="font-mono text-ink">claude_desktop_config.json</code> or <code className="font-mono text-ink">.cursor/mcp.json</code>:
                    </p>
                    <CopyBox text={desktopJson} id="desktop-json" />
                </div>
            )}

            {tab === 'code' && (
                <div className="space-y-3 text-xs text-ink2">
                    <p className="text-muted">Run once in your terminal:</p>
                    <CopyBox text={claudeCodeCmd} id="code-cmd" />
                </div>
            )}

            {tab === 'cli' && (
                <div className="space-y-3 text-xs text-ink2">
                    <p className="text-muted">Zero-dependency Python CLI &mdash; works from the terminal or any agent with bash access:</p>
                    <CopyBox text={cliCmd} id="cli-cmd" />
                </div>
            )}
        </section>
    );
}
