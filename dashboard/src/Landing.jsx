import React from 'react';
import { Sparkles, Zap, Globe, FileVideo, Subtitles, Youtube, Instagram, Shield, Github, ArrowRight, Check, ChevronDown, Monitor, Cpu, Type, Upload, Scissors, Link2, Bot } from 'lucide-react';
import SiteNav from './components/SiteNav';
import './landing.css';

const APPARATUS_CALLOUTS = ['RATIO · 9:16', 'CLIPS · 3–15', 'HOOK · AUTO', 'SUBS · WORD-LEVEL'];

// Real clips OpenShorts made from Creative Commons (CC BY) sources. `video` is
// the original and the clip side by side, in sync; `vertical` is the clip on
// its own for the hero. The credit is what the licence asks for, so it stays
// next to the video that uses it.
// The six clips OpenShorts cut from that episode with no clip-count setting,
// in source order, with the score the moment picker gave each.
const EPISODE_CLIPS = [
  { n: 1, score: 88, title: 'I knew I was marrying her on our third date' },
  { n: 2, score: 82, title: 'Why we do absolutely everything together' },
  { n: 3, score: 75, title: 'She did a deep dive on my old social media' },
  { n: 4, score: 85, title: 'How we won a bidding war with a photo' },
  { n: 5, score: 72, title: 'Using our past to help others find freedom' },
  { n: 6, score: 78, title: 'The real definition of a winner' },
];

// Mounts the video only once it scrolls near the viewport, so five clip
// previews cost nothing to a visitor who never gets that far.
function LazyLoopVideo({ src, poster }) {
  const ref = React.useRef(null);
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShow(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShow(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="aspect-[9/16] w-full">
      {show ? (
        <video src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" className="w-full h-full object-cover block" />
      ) : (
        <img src={poster} alt="" loading="lazy" className="w-full h-full object-cover block" />
      )}
    </div>
  );
}

const DEMOS = [
  {
    id: 'split',
    tab: 'two speakers',
    video: '/demo/case-split.mp4',
    poster: '/screens/case-split.webp',
    vertical: '/demo/split-vertical.mp4',
    posterV: '/screens/split-vertical.webp',
    credit: 'Turn the Tables with Dan and Shoshana Jordan',
    creditBy: 'Heritage of Faith',
    creditUrl: 'https://www.youtube.com/watch?v=-KbQj_vboOU',
  },
  {
    id: 'talk',
    tab: 'face tracking',
    video: '/demo/case-talk.mp4',
    poster: '/screens/case-talk.webp',
    vertical: '/demo/talk-vertical.mp4',
    posterV: '/screens/talk-vertical.webp',
    credit: 'Mark Bush on How to Overcome Adversity',
    creditBy: 'Foundation for Economic Education',
    creditUrl: 'https://www.youtube.com/watch?v=aqFhllJJzoQ',
  },
];

const SectionHeader = ({ eyebrow, title, children }) => (
  <div className="mb-12">
    <p className="eyebrow mb-3">{eyebrow}</p>
    <h2 className="font-display text-3xl md:text-4xl lowercase text-ink tracking-tight mb-4">{title}</h2>
    {children && <p className="text-muted max-w-2xl leading-relaxed">{children}</p>}
  </div>
);

// Every feature with its real visual: screenshots of the app and clips it
// made. Rotates on its own until the visitor picks a tab.
const SHOWCASE = [
  {
    id: 'moments', tab: 'finds the moments',
    title: 'every clip scored before you see it',
    body: 'Gemini reads the word-level transcript and the scene cuts, scores each moment out of 100, and writes the title and the description for every platform.',
    media: { type: 'img', src: '/screens/app-clipcard.webp', w: 1153, h: 441, alt: 'A clip in Clarity with its viral score, titles and edit actions' },
  },
  {
    id: 'reframe', tab: 'reframes any layout',
    title: 'one face, two speakers, a whole screen',
    body: 'Face tracking for one person, both speakers stacked for a two-shot, the screen kept whole for a screencast. Picked per video, nothing to configure.',
    media: { type: 'video', src: '/demo/case-split.mp4', poster: '/screens/case-split.webp', w: 960, h: 540 },
  },
  {
    id: 'captions', tab: '17 caption styles',
    title: 'captions people actually read',
    body: 'Word-level captions burned in, in 17 styles: Hormozi, pill, lime box, one word at a time, karaoke and more. Change the style of any clip in one click.',
    media: { type: 'captions' },
  },
  {
    id: 'hook', tab: 'hooks that stop the scroll',
    title: 'a hook on the first second',
    body: 'Every clip opens with a hook line written from what is said in it. Rewrite it, restyle it or move it before you post.',
    media: { type: 'img', src: '/screens/app-hook.webp', w: 548, h: 587, alt: 'The hook editor with text, style, font and position' },
  },
  {
    id: 'editor', tab: 'a real editor',
    title: 'fix anything, down to the word',
    body: 'Source and program monitors side by side with the full transcript: click a word to set a cut, add segments, change the framing, re-render in seconds.',
    media: { type: 'img', src: '/screens/app-editor.webp', w: 1568, h: 652, alt: 'The Clarity clip editor with source monitor, program monitor, transcript and segments' },
  },
  {
    id: 'agents', tab: 'inside claude & chatgpt',
    title: 'clip from a chat',
    body: 'Add Clarity to Claude or ChatGPT with one URL and ask for clips. Same pipeline, completely free.',
    media: { type: 'img', src: '/screens/connect-an-agent.webp', w: 684, h: 366, alt: 'Connecting Clarity to an AI agent' },
  },
];

const CAPTION_STYLES = [
  ['default', 'default'], ['hormozi', 'hormozi'], ['pill', 'pill'], ['lime', 'lime box'], ['oneword', 'one word'],
];

function ShowcaseMedia({ media }) {
  if (media.type === 'video') {
    return (
      <video src={media.src} poster={media.poster} autoPlay muted loop playsInline preload="metadata"
        width={media.w} height={media.h} className="w-full h-auto block rounded-card" />
    );
  }
  if (media.type === 'captions') {
    return (
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {CAPTION_STYLES.map(([id, label]) => (
          <figure key={id} className="m-0 min-w-0">
            <video src={`/demo/caption-${id}.mp4`} poster={`/screens/caption-${id}.webp`} autoPlay muted loop playsInline
              preload="metadata" className="w-full aspect-[9/16] object-cover block rounded-card border border-rule" />
            <figcaption className="readout text-[10px] text-muted mt-2 text-center">{label}</figcaption>
          </figure>
        ))}
      </div>
    );
  }
  return (
    <img src={media.src} alt={media.alt} width={media.w} height={media.h} loading="lazy"
      className="w-full h-auto block rounded-card border border-rule" />
  );
}

function FeatureShowcase() {
  const [active, setActive] = React.useState(0);
  const [auto, setAuto] = React.useState(true);
  React.useEffect(() => {
    if (!auto) return undefined;
    const t = setTimeout(() => setActive((i) => (i + 1) % SHOWCASE.length), 7000);
    return () => clearTimeout(t);
  }, [active, auto]);
  const item = SHOWCASE[active];
  return (
    <div className="grid lg:grid-cols-[17rem_minmax(0,1fr)] gap-6 lg:gap-10 items-start">
      <div className="flex lg:flex-col gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Features">
        {SHOWCASE.map((f, i) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => { setActive(i); setAuto(false); }}
            className={`relative shrink-0 text-left rounded-card border px-4 py-3 text-sm lowercase transition-colors overflow-hidden ${i === active ? 'border-brass text-ink bg-paper2' : 'border-rule text-muted hover:text-ink'}`}
          >
            {f.tab}
            {i === active && auto && (
              <span key={`p-${active}`} className="showcase-progress absolute left-0 bottom-0 h-0.5 bg-brass" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      <div key={item.id} className="showcase-in min-w-0" role="tabpanel">
        <h3 className="font-display text-3xl md:text-4xl lowercase text-ink mb-3">{item.title}</h3>
        <p className="text-muted max-w-2xl mb-6 leading-relaxed">{item.body}</p>
        <ShowcaseMedia media={item.media} />
      </div>
    </div>
  );
}

const FeatureCard = ({ icon, title, description }) => {
  const Icon = icon;
  return (
    <div className="card card-hover p-6">
      <div className="w-10 h-10 rounded-input bg-paper3 flex items-center justify-center mb-4">
        <Icon size={18} className="text-brass" />
      </div>
      <h3 className="font-display text-xl lowercase text-ink mb-2">{title}</h3>
      <p className="text-muted text-sm leading-relaxed">{description}</p>
    </div>
  );
};

const StepCard = ({ number, title, description }) => (
  <div className="flex gap-5">
    <span className="font-mono text-micro text-brass uppercase pt-1.5 flex-shrink-0">
      {String(number).padStart(2, '0')}
    </span>
    <div>
      <h3 className="text-ink font-medium mb-1">{title}</h3>
      <p className="text-muted text-sm leading-relaxed">{description}</p>
    </div>
  </div>
);

const ComparisonRow = ({ feature, openshorts, opusclip, kapwing }) => (
  <tr className="border-b border-rule">
    <td className="py-3 px-4 text-sm text-ink2">{feature}</td>
    <td className="py-3 px-4 text-center">{openshorts}</td>
    <td className="py-3 px-4 text-center">{opusclip}</td>
    <td className="py-3 px-4 text-center">{kapwing}</td>
  </tr>
);

const FAQItem = ({ question, answer, isOpen, onClick }) => (
  <div>
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-1 py-5 text-left"
    >
      <span className="text-ink font-medium pr-4">{question}</span>
      <ChevronDown size={18} className={`text-muted flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && (
      <div className="px-1 pb-6">
        <p className="faq-answer text-muted text-sm leading-relaxed">{answer}</p>
      </div>
    )}
  </div>
);

// Internal links to the per-platform pages. The same links, in the same order,
// are in seo/landing-fallback.js so they exist in the static HTML too.
const LINK = 'text-ink2 underline underline-offset-2 hover:text-ink transition-colors';

const WORKS_WITH = [
  ['/platforms/youtube', 'youtube'],
  ['/platforms/twitch', 'twitch'],
  ['/platforms/kick', 'kick'],
  ['/platforms/tiktok', 'tiktok'],
  ['/podcast-to-shorts', 'podcasts'],
];

const PLATFORMS = [
  {
    icon: Youtube,
    title: 'YouTube clips',
    text: 'Paste a YouTube link and get vertical clips back, Shorts for your own channel, or the whole video turned into 9:16 pieces.',
    links: [['/platforms/youtube', 'YouTube clip maker'], ['/platforms/youtube-shorts', 'YouTube Shorts maker'], ['/youtube-to-shorts-converter', 'YouTube to Shorts converter']],
  },
  {
    icon: Instagram,
    title: 'TikTok & Reels',
    text: 'The same clips, captioned and with a hook, sent to TikTok and Instagram Reels from the dashboard.',
    links: [['/platforms/tiktok', 'TikTok clip maker'], ['/platforms/instagram-reels', 'AI reel generator']],
  },
  {
    icon: Monitor,
    title: 'Streams',
    text: 'Hours-long Twitch and Kick VODs clipped in parts, with the facecam kept and quiet gameplay still handled.',
    links: [['/platforms/twitch', 'Twitch clip maker'], ['/platforms/kick', 'Kick clip maker'], ['/gta-5-clips', 'GTA 5 clips'], ['/gta-6-clips', 'GTA 6 clips'], ['/wow-forever-clips', 'WoW Forever clips']],
  },
  {
    icon: FileVideo,
    title: 'Podcasts & talks',
    text: 'Both podcast hosts kept in frame, only the sermon clipped out of a service, and a speaker who walks the stage tracked.',
    links: [['/podcast-to-shorts', 'Podcast clip maker'], ['/use-cases/sermons', 'Sermon clip maker'], ['/auto-reframe', 'Auto reframe']],
  },
];

const SWITCHING = [
  ['/alternatives/opus-clip', 'vs opus clip'],
  ['/alternatives/klap', 'vs klap'],
  ['/alternatives/vizard', 'vs vizard'],
  ['/alternatives/submagic', 'vs submagic'],
  ['/free-ai-clipping-tools-compared', 'free plans compared'],
  ['/alternatives', 'all alternatives'],
];

// A landing section anchor (#pricing, #features…), not an app route (#app,
// #/pricing, #legal…).
const NOT_SECTIONS = new Set(['app', 'landing', 'legal']);
const sectionId = (hash) => {
  const m = /^#([a-z][\w-]*)$/i.exec(hash || '');
  return m && !NOT_SECTIONS.has(m[1]) ? m[1] : null;
};

// Arriving on /#pricing (the nav's "pricing" from every static page): the
// browser jumps to the anchor in the static fallback, then React replaces the
// fallback and the jump is lost. The pricing section also renders only once
// /api/config says billing is on. So scroll once the section exists, keep it
// aligned for a moment while late content above settles, and give up after a
// few seconds or as soon as the visitor scrolls on their own.
function useScrollToHashSection() {
  React.useEffect(() => {
    const id = sectionId(window.location.hash);
    if (!id) return undefined;
    let stopped = false;
    let foundAt = 0;
    let timer;
    const start = Date.now();
    const stop = () => { stopped = true; };
    const events = ['wheel', 'touchstart', 'keydown', 'mousedown'];
    events.forEach((e) => window.addEventListener(e, stop, { passive: true }));
    const tick = () => {
      if (stopped) return;
      const el = document.getElementById(id);
      if (el) {
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        if (Math.abs(el.getBoundingClientRect().top - margin) > 4) el.scrollIntoView({ block: 'start' });
        if (!foundAt) foundAt = Date.now();
        if (Date.now() - foundAt > 1500) return;
      } else if (Date.now() - start > 6000) {
        return;
      }
      timer = setTimeout(tick, 100);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, stop));
    };
  }, []);
}

// A click on a link to a section of this page (the nav's /#pricing, the
// in-page #pricing buttons) scrolls smoothly instead of jumping, and closes
// the mobile menu or the open dropdown it came from.
function useSmoothSectionLinks() {
  React.useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || (a.target && a.target !== '_self')) return;
      let url;
      try { url = new URL(a.getAttribute('href'), window.location.href); } catch { return; }
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
      const id = sectionId(url.hash);
      const el = id && document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (window.location.hash !== url.hash) window.history.pushState(null, '', url.hash);
      document.querySelectorAll('.osn-toggle').forEach((t) => { t.checked = false; });
      document.querySelectorAll('[data-osn-dd][open]').forEach((d) => { d.open = false; });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
}

export default function Landing({ onLaunchApp }) {
  useScrollToHashSection();
  useSmoothSectionLinks();
  const [openFaq, setOpenFaq] = React.useState(null);
  // Start from whatever was typed into the static paste box of the crawler
  // fallback (seo/landing-fallback.js) before this component mounted: the
  // fallback DOM is still in #root while the first render runs.
  const [heroUrl, setHeroUrl] = React.useState(() => {
    try { return document.getElementById('seo-hero-url')?.value || ''; } catch { return ''; }
  });
  const [heroDemo, setHeroDemo] = React.useState(0);
  const [cropDemo, setCropDemo] = React.useState(0);
  // Floating CTA: shown once the hero's own input has scrolled away, hidden
  // again near the end where the closing CTA takes over.
  const [stickyCta, setStickyCta] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => {
      const form = document.querySelector('.hero-input-row');
      const pastHero = form ? form.getBoundingClientRect().bottom < 0 : window.scrollY > 700;
      const nearEnd = window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 1100;
      setStickyCta(pastHero && !nearEnd);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Hand the pasted link to the app: MediaInput picks it up on mount.
  const handleHeroSubmit = (e) => {
    e.preventDefault();
    const url = heroUrl.trim();
    if (url) {
      try { localStorage.setItem('clarity_pending_url', url); } catch { /* ignore */ }
    }
    onLaunchApp();
  };

  const features = [
    {
      icon: Sparkles,
      title: "AI Viral Moment Detection",
      description: "Google Gemini 3.1 Flash-Lite scores your transcript and scenes to find the 3-15 most engaging moments. Automatic AI clipping, no manual scrubbing."
    },
    {
      icon: Scissors,
      title: "Smart 9:16 Vertical Cropping",
      description: "Dual-mode AI reframing with MediaPipe face tracking and YOLOv8 fallback."
    },
    {
      icon: Subtitles,
      title: "Automatic Subtitle Generation",
      description: "faster-whisper subtitles with word-level timestamps, styled and burned into your clips."
    },
    {
      icon: Type,
      title: "Hook Text Overlays",
      description: "AI-generated hook titles that capture viewers in the first 3 seconds."
    },
    {
      icon: Zap,
      title: "AI Video Effects",
      description: "Gemini-generated FFmpeg filters: color grading, transitions, visual enhancements."
    },
    {
      icon: Upload,
      title: "Local Video Upload",
      description: "Upload podcasts, webinars, livestreams, and vlogs at full resolution."
    },
    {
      icon: Shield,
      title: "100% Free & Self-Hosted",
      description: "Run it locally or with Docker on your own machine — no watermarks, no subscriptions, and full privacy."
    },
    {
      icon: Monitor,
      title: "Free AI YouTube Studio",
      description: "Free AI thumbnail generator, 10 viral title suggestions, and auto descriptions with chapters."
    },
    {
      icon: Globe,
      title: "Direct Social Publishing",
      description: "Post to TikTok, Instagram Reels, and YouTube Shorts from the dashboard."
    },
    {
      icon: Bot,
      title: "MCP Server, API & CLI for AI Agents",
      description: "Connect Claude, ChatGPT or n8n to your endpoint, or run pip install ./cli and clip from the terminal. Same pipeline, no dashboard needed."
    }
  ];

  const steps = [
    { title: "Upload a Long-Form Video", description: "Drop any video file you own — podcasts, webinars, livestreams, interviews." },
    { title: "AI Detects the Best Viral Moments", description: "Google Gemini 3.1 Flash-Lite finds 3-15 high-potential clips of 15-60 seconds." },
    { title: "Smart Cropping to Vertical 9:16", description: "AI reframes to vertical with face tracking — subjects stay centered." },
    { title: "Add Subtitles, Hooks & Effects", description: "Auto subtitles, hook overlays and AI effects." },
    { title: "Download or Post to Social Media", description: "Export your clips with zero watermarks or post directly to TikTok, Instagram Reels, and YouTube Shorts." }
  ];

  const faqs = [
    {
      question: "Is Clarity really 100% free?",
      answer: "Yes! Clarity is 100% free and open source under the MIT licence, with no watermarks, no usage limits, and no paid subscriptions. You simply use a free Google Gemini API key (free tier includes 1,500 requests/day)."
    },
    {
      question: "Do the clips have a watermark?",
      answer: "Never. Every clip generated by Clarity is exported cleanly without any watermark."
    },
    {
      question: "Do I need a credit card to use Clarity?",
      answer: "No. Clarity has no billing, no paid tiers, and never asks for a credit card."
    },
    {
      question: "How many clips do I get from one video?",
      answer: "Between 3 and 15, each 15 to 60 seconds long. The AI scores every moment of the video and keeps the ones that hold up as standalone clips, so the number depends on the source, not on a fixed quota."
    },
    {
      question: "Can I clip someone else's YouTube video?",
      answer: "Only if you own it or have the rights or permission to use it. Before a video is processed, Clarity asks you to confirm you own the content or have the rights to it, and you are responsible for what you submit."
    },
    {
      question: "What is Clarity and how does it work?",
      answer: "Clarity is an open source AI clip generator that transforms your long-form videos — podcasts, webinars, livestreams, vlogs, interviews — into viral-ready short clips in 9:16 vertical format. It uses faster-whisper for transcription with word-level timestamps, PySceneDetect for scene boundary detection, and Google Gemini 3.1 Flash-Lite AI for identifying the most engaging viral moments."
    },
    {
      question: "Can Clarity generate YouTube thumbnails and titles for free?",
      answer: "Yes. Clarity includes a free AI YouTube thumbnail generator, a free AI YouTube title generator, and a free AI YouTube description generator — all powered by Google Gemini 3.1 Flash-Lite."
    },
    {
      question: "How does the smart vertical cropping work?",
      answer: "Clarity offers intelligent cropping modes for converting 16:9 horizontal video to 9:16 vertical format. TRACK mode uses MediaPipe face detection with YOLOv8 as fallback to follow a single subject with smooth stabilization. GENERAL mode handles group shots and landscapes by creating a blurred background layout."
    },
    {
      question: "Can I automate Clarity from Claude, ChatGPT or n8n?",
      answer: "Yes. Clarity includes a built-in MCP server at /mcp, a REST API, and a zero-dependency CLI so AI agents and workflows can submit a video, wait for processing, and download or publish clips."
    },
    {
      question: "What are the system requirements to run Clarity?",
      answer: "Clarity runs on any system with Python 3.11+ and FFmpeg, or via Docker. The recommended setup is 8GB+ RAM and a modern multi-core CPU. GPU acceleration (NVIDIA CUDA) is optional."
    }
  ];

  const checkIcon = <Check size={16} className="text-brass mx-auto" />;
  const checkMuted = <Check size={16} className="text-muted mx-auto" />;
  const xIcon = <span className="text-muted text-sm">Paid</span>;

  return (
    <div className="min-h-screen bg-paper text-ink2 overflow-x-clip">
      {/* Navigation: the shared site nav (seo/nav.js), same items as every page */}
      <SiteNav className="fixed top-0 w-full z-50" />

      {/* Hero — Marquee Hero: blueprint grid, content left, apparatus right */}
      <section className="hero-blueprint relative overflow-clip border-b border-rule pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-14 items-center">
          <div className="min-w-0">
            <p className="eyebrow mb-6">00 · Free AI Clip Generator · Open Source</p>

            <h1 className="hero-h1 mb-6">
              <span className="block">free ai clip maker:</span>{' '}
              <span className="block">long video in,</span>{' '}
              <span className="block"><em>viral shorts</em> out.</span>
            </h1>

            <p className="hero-description text-muted max-w-2xl mb-8 leading-relaxed lowercase">
              paste a youtube link or upload a podcast, stream or interview. the ai picks the 3 to 15 moments worth posting,
              reframes them to 9:16 around the people talking, and burns in the captions. ready for tiktok, reels and shorts in minutes.
            </p>

            {/* The hero CTA is the product itself: paste a link and land in the
                app with it loaded. Sign-in is asked for at generate time, not
                before the user has seen anything. */}
            <form onSubmit={handleHeroSubmit} className="mb-5">
              <div className="hero-input-row flex flex-col sm:flex-row items-stretch gap-3">
                <div className="relative flex-1 min-w-0">
                  <Link2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    type="url"
                    value={heroUrl}
                    onChange={(e) => setHeroUrl(e.target.value)}
                    placeholder="paste a video link"
                    className="input-field pl-11"
                    aria-label="Video link"
                  />
                </div>
                <button type="submit" className="btn-primary whitespace-nowrap">
                  get free clips
                  <ArrowRight size={16} />
                </button>
                <button type="button" onClick={onLaunchApp} className="btn-ghost whitespace-nowrap">
                  <Upload size={16} />
                  upload a file
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-5 text-sm">
              <span className="badge-ok whitespace-nowrap">
                <Check size={12} /> 100% free &amp; open source
              </span>
              <span className="text-muted lowercase">no watermarks · no usage limits · no subscriptions</span>
            </div>

            <p className="mt-4 text-sm text-muted lowercase">
              works with links from{' '}
              {WORKS_WITH.map(([href, label], i) => (
                <React.Fragment key={href}>
                  {i > 0 && ' · '}
                  <a href={href} className={LINK}>{label}</a>
                </React.Fragment>
              ))}
            </p>
          </div>

          {/* Apparatus — instrument bezel holding a real 9:16 clip */}
          <figure className="apparatus" aria-label="example vertical clip generated by clarity">
            <div className="apparatus-shell">
              <span className="apparatus-glow" aria-hidden="true" />
              <div className="apparatus-chamber">
                <video
                  key={DEMOS[heroDemo].id}
                  src={DEMOS[heroDemo].vertical}
                  poster={DEMOS[heroDemo].posterV}
                  autoPlay
                  muted
                  loop={DEMOS.length === 1}
                  onEnded={() => setHeroDemo((i) => (i + 1) % DEMOS.length)}
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
                <span className="apparatus-stencil">OS-9:16</span>
              </div>
            </div>
            <ul className="apparatus-callouts" aria-hidden="true">
              {APPARATUS_CALLOUTS.map((c) => (
                <li key={c}><span className="apparatus-leader" />{c}</li>
              ))}
            </ul>
          </figure>
        </div>
      </section>

      {/* Proof: real usage numbers. Update by hand; never round them up. */}
      <section className="border-b border-rule">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-y-8 md:divide-x divide-rule text-center">
          {[
            ['45,000+', 'accounts created'],
            ['32,900+', 'videos clipped'],
            ['8,300+', 'hours of video processed'],
            ['7.5k', 'github stars'],
          ].map(([n, label]) => (
            <div key={label} className="px-4">
              <div className="font-display text-4xl md:text-5xl text-ink tabular-nums">{n}</div>
              <div className="eyebrow mt-2">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* By platform: one described card per source/destination, linking the
          per-platform pages. */}
      <section id="platforms" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeader eyebrow="Platforms" title="Made for every platform: YouTube, TikTok, streams and podcasts">
            One clip generator, tuned to where the video comes from and where the clips are going.
          </SectionHeader>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLATFORMS.map((p) => (
              <div key={p.title} className="card p-6 flex flex-col">
                <p.icon size={18} className="text-brass mb-4" />
                <h3 className="font-display text-xl lowercase text-ink mb-2">{p.title}</h3>
                <p className="text-muted text-sm leading-relaxed mb-4">{p.text}</p>
                <ul className="mt-auto space-y-1.5 text-sm lowercase">
                  {p.links.map(([href, label]) => (
                    <li key={href}><a href={href} className={LINK}>{label} →</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm lowercase">
            <a href="/platforms" className={LINK}>every platform and its specs →</a>
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 border-t border-rule">
        <div className="max-w-6xl mx-auto">
          <SectionHeader eyebrow="01 · Features" title="AI clipping that finds the moments worth posting">
            Screens from the app and clips it made. Pick a feature, or let it play.
          </SectionHeader>
          <FeatureShowcase />
          <details className="mt-12 group">
            <summary className="list-none cursor-pointer text-sm text-muted hover:text-ink lowercase [&::-webkit-details-marker]:hidden">
              the full feature list <ChevronDown size={14} className="inline transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
              {features.map((feature, i) => (
                <FeatureCard key={i} {...feature} />
              ))}
            </div>
          </details>
        </div>
      </section>

      {/* One video in, many clips out: the real clips OpenShorts cut from one
          CC BY episode with default settings, with the score the AI gave each.
          The pattern the market leader opens with, shown with our own output. */}
      <section className="py-20 px-6 border-b border-rule">
        <div className="max-w-6xl mx-auto">
          <SectionHeader eyebrow="02 · One Video, Six Clips" title="one 27-minute episode in. six ready-to-post clips out.">
            No prompts, no settings and no scrubbing: the AI scored every moment, kept the six that stand on their own and cut them with captions and a hook.
          </SectionHeader>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,15rem)_auto_minmax(0,1fr)] gap-6 items-center">
            <figure className="m-0 max-w-[16rem] lg:max-w-none">
              <div className="relative rounded-card overflow-hidden border border-rule">
                <img src="/screens/ep-source.webp" alt="The original 16:9 podcast episode" width="640" height="360" loading="lazy" className="block w-full h-auto" />
                <span className="absolute bottom-2 right-2 readout bg-paper/80 px-2 py-0.5 rounded">26:54</span>
              </div>
              <figcaption className="text-xs text-muted mt-2">the full episode, 16:9</figcaption>
            </figure>
            <ArrowRight size={28} className="text-brass mx-auto rotate-90 lg:rotate-0" aria-hidden="true" />
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {EPISODE_CLIPS.map((c) => (
                <figure key={c.n} className="m-0 min-w-0">
                  <div className="relative rounded-card overflow-hidden border border-rule bg-paper2">
                    <LazyLoopVideo src={`/demo/ep-clip-${c.n}.mp4`} poster={`/screens/ep-clip-${c.n}.webp`} />
                    <span className="absolute top-1.5 left-1.5 readout text-[10px] bg-paper/85 text-ok px-1.5 py-0.5 rounded">score {c.score}</span>
                  </div>
                  <figcaption className="text-xs text-ink2 mt-2 leading-snug">{c.title}</figcaption>
                </figure>
              ))}
            </div>
          </div>
          <p className="mt-6 text-xs text-muted">
            Source: <a href="https://www.youtube.com/watch?v=-KbQj_vboOU" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">Turn the Tables with Dan and Shoshana Jordan</a>, Heritage of Faith, licensed CC BY. Clipped by Clarity, scores as the AI gave them.
          </p>
        </div>
      </section>

      {/* Smart crop — real product output: 16:9 source to 9:16 result */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader eyebrow="03 · Smart Crop" title="one video in. the moment, reframed.">
            Real output, not a mock-up: the AI picks the moment, reframes 16:9 to vertical 9:16 and burns in the captions.
          </SectionHeader>
          {DEMOS.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-8" role="tablist" aria-label="Example clips">
              {DEMOS.map((d, i) => (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={cropDemo === i}
                  onClick={() => setCropDemo(i)}
                  className={`px-4 py-1.5 rounded-full border text-sm lowercase transition-colors ${cropDemo === i ? 'bg-brass text-brassink border-brass' : 'border-rule text-muted hover:text-ink'}`}
                >
                  {d.tab}
                </button>
              ))}
            </div>
          )}
          <figure className="crop-frame crop-frame-16-9 w-full" aria-label="original video next to the vertical clip Clarity made from it">
            <video
              key={DEMOS[cropDemo].id}
              src={DEMOS[cropDemo].video}
              poster={DEMOS[cropDemo].poster}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              width="960"
              height="540"
              className="w-full h-auto block"
            />
          </figure>
          <p className="mt-6 text-xs text-muted">
            Source: <a href={DEMOS[cropDemo].creditUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">{DEMOS[cropDemo].credit}</a>, {DEMOS[cropDemo].creditBy}, licensed CC BY. Clipped by Clarity.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                document.querySelector('.hero-input-row input')?.focus({ preventScroll: true });
              }}
              className="btn-primary whitespace-nowrap"
            >
              try it on your own video <ArrowRight size={16} />
            </button>
            <span className="text-sm text-muted">100% free, no watermarks, no credit card</span>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-6 border-t border-rule">
        <div className="max-w-4xl mx-auto">
          <SectionHeader eyebrow="04 · Pipeline" title="How to turn a long video into Shorts with AI (5 steps)">
            From long-form video to viral-ready clips in 5 automated steps.
          </SectionHeader>
          <div className="space-y-8">
            {steps.map((step, i) => (
              <StepCard key={i} number={i + 1} {...step} />
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section id="comparison" className="py-20 px-6 border-t border-rule">
        <div className="max-w-4xl mx-auto">
          <SectionHeader eyebrow="05 · Comparison" title="Clarity vs Opus Clip, Klap and Vizard">
            Clarity is 100% free and open source with zero watermarks or usage quotas.
          </SectionHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-rule2">
                  <th className="py-3 px-4 text-left text-sm text-muted font-medium">Feature</th>
                  <th className="py-3 px-4 text-center text-sm font-medium">
                    <span className="text-brass">Clarity</span>
                    <span className="block text-xs text-muted font-normal">100% Free</span>
                  </th>
                  <th className="py-3 px-4 text-center text-sm text-muted font-medium">Opus Clip</th>
                  <th className="py-3 px-4 text-center text-sm text-muted font-medium">Kapwing</th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow feature="Price" openshorts={<span className="text-ok font-medium">$0 Free Forever</span>} opusclip={xIcon} kapwing={xIcon} />
                <ComparisonRow feature="AI Viral Moment Detection" openshorts={checkIcon} opusclip={checkMuted} kapwing={checkMuted} />
                <ComparisonRow feature="Smart Vertical Cropping" openshorts={checkIcon} opusclip={checkMuted} kapwing={checkMuted} />
                <ComparisonRow feature="Auto Subtitles" openshorts={checkIcon} opusclip={checkMuted} kapwing={checkMuted} />
                <ComparisonRow feature="AI Video Effects" openshorts={checkIcon} opusclip={<span className="text-muted text-sm">No</span>} kapwing={checkMuted} />
                <ComparisonRow feature="Hook Text Overlays" openshorts={checkIcon} opusclip={checkMuted} kapwing={checkMuted} />
                <ComparisonRow feature="Self-Hosted / Privacy" openshorts={checkIcon} opusclip={<span className="text-muted text-sm">Cloud only</span>} kapwing={<span className="text-muted text-sm">Cloud only</span>} />
                <ComparisonRow feature="No Watermark" openshorts={<span className="text-ok text-sm">Always watermark-free</span>} opusclip={<span className="text-muted text-sm">Paid only</span>} kapwing={<span className="text-muted text-sm">Paid</span>} />
                <ComparisonRow feature="Open Source" openshorts={checkIcon} opusclip={<span className="text-muted text-sm">No</span>} kapwing={<span className="text-muted text-sm">No</span>} />
                <ComparisonRow feature="AI YouTube Thumbnail Generator" openshorts={checkIcon} opusclip={<span className="text-muted text-sm">No</span>} kapwing={<span className="text-muted text-sm">Paid</span>} />
                <ComparisonRow feature="AI Title & Description Generator" openshorts={checkIcon} opusclip={<span className="text-muted text-sm">Limited</span>} kapwing={<span className="text-muted text-sm">Paid</span>} />
                <ComparisonRow feature="Usage Limits" openshorts={<span className="text-ok text-sm">Unlimited</span>} opusclip={<span className="text-muted text-sm">Per plan</span>} kapwing={<span className="text-muted text-sm">Per plan</span>} />
              </tbody>
            </table>
          </div>
          <div className="mt-10">
            <h3 className="font-display text-xl lowercase text-ink mb-4">switching from another tool?</h3>
            <div className="flex flex-wrap gap-2">
              {SWITCHING.map(([href, label]) => (
                <a key={href} href={href} className="px-4 py-1.5 rounded-full border border-rule text-sm lowercase text-muted hover:text-ink hover:border-brass transition-colors">
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-6 border-t border-rule">
        <div className="max-w-5xl mx-auto">
          <SectionHeader eyebrow="06 · Use Cases" title="Who Uses Clarity?">
            Creators, marketers, and educators scaling short-form video production for free.
          </SectionHeader>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                title: "Content Creators",
                description: "Repurpose long-form videos into TikTok and Reels clips automatically.",
                icon: Youtube
              },
              {
                title: "Social Media Managers",
                description: "Batch-process videos and publish for multiple channels from one dashboard.",
                icon: Instagram
              },
              {
                title: "Podcasters & Educators",
                description: "Extract the most engaging moments from episodes and lessons.",
                icon: FileVideo
              }
            ].map((useCase, i) => (
              <div key={i} className="card p-6">
                <useCase.icon size={18} className="text-brass mb-4" />
                <h3 className="font-display text-xl lowercase text-ink mb-2">{useCase.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-6 border-t border-rule">
        <div className="max-w-3xl mx-auto">
          <SectionHeader eyebrow="07 · FAQ" title="FAQ: free AI clipping and features">
            Everything you need to know about Clarity, from setup to features.
          </SectionHeader>
          <div className="divide-y divide-rule border-y border-rule">
            {faqs.map((faq, i) => (
              <FAQItem
                key={i}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFaq === i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Self-hosting details */}
      <section className="py-16 px-6 border-t border-rule">
        <div className="max-w-5xl mx-auto">
          <details className="group">
            <summary className="list-none cursor-pointer flex items-center justify-between gap-6 [&::-webkit-details-marker]:hidden">
              <div>
                <span className="eyebrow block mb-3">08 · Self-Hosting</span>
                <h2 className="font-display text-2xl md:text-3xl lowercase text-ink">Open source: run the pipeline on your own hardware</h2>
              </div>
              <ChevronDown size={22} className="text-muted shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            {/* API Keys Section */}
            <section className="pt-12">
              <div className="max-w-5xl mx-auto">
                <SectionHeader eyebrow="API Keys" title="Free API keys">
                  Clarity runs with a free Google Gemini API key, plus optional social publishing:
                </SectionHeader>
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="card p-6 relative">
                    <span className="badge-brass absolute top-4 right-4">Required</span>
                    <div className="w-10 h-10 rounded-input bg-paper3 flex items-center justify-center mb-4">
                      <Cpu size={18} className="text-brass" />
                    </div>
                    <h3 className="font-display text-xl lowercase text-ink mb-1">Google Gemini API</h3>
                    <div className="mb-3"><span className="badge-ok">Free tier: 1,500 req/day</span></div>
                    <p className="text-muted text-sm leading-relaxed">Powers all AI features: viral moment detection, title generation, video effects, YouTube thumbnail creation, and description writing. The core engine of Clarity.</p>
                  </div>
                  <div className="card p-6 relative">
                    <span className="readout absolute top-4 right-4 border border-rule rounded-full px-2.5 py-1">Optional</span>
                    <div className="w-10 h-10 rounded-input bg-paper3 flex items-center justify-center mb-4">
                      <Globe size={18} className="text-brass" />
                    </div>
                    <h3 className="font-display text-xl lowercase text-ink mb-1">Upload-Post API</h3>
                    <div className="mb-3"><span className="badge-ok">Free tier included</span></div>
                    <p className="text-muted text-sm leading-relaxed">Enables direct publishing to YouTube, TikTok, and Instagram Reels from the dashboard without leaving Clarity.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Tech Stack */}
            <section className="pt-12">
              <div className="max-w-5xl mx-auto">
                <SectionHeader eyebrow="Stack" title="Built with Proven Technology">
                  Industry-leading AI models and open source tools in one pipeline.
                </SectionHeader>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { name: "Google Gemini 3.1", desc: "AI Analysis" },
                    { name: "faster-whisper", desc: "Transcription" },
                    { name: "YOLOv8", desc: "Object Detection" },
                    { name: "MediaPipe", desc: "Face Tracking" },
                    { name: "FFmpeg", desc: "Video Processing" },
                    { name: "React + Vite", desc: "Dashboard" },
                    { name: "Docker", desc: "Deployment" }
                  ].map((tech, i) => (
                    <div key={i} className="border border-rule rounded-input bg-paper2 px-4 py-3 text-center">
                      <div className="readout text-ink2">{tech.name}</div>
                      <div className="text-xs text-muted mt-1">{tech.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          </details>
        </div>
      </section>

      {/* CTA Section — final statement */}
      <section className="py-24 px-6 border-t border-rule">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-4xl md:text-5xl lowercase text-ink tracking-tight mb-5">start creating viral videos today.</h2>
          <p className="text-muted mb-10 max-w-xl mx-auto leading-relaxed lowercase">100% free &amp; open source · no watermarks · no usage limits · no subscriptions.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button onClick={onLaunchApp} className="btn-primary whitespace-nowrap">
              launch clarity
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Floating CTA, the same form as the hero */}
      <form
        onSubmit={handleHeroSubmit}
        aria-hidden={!stickyCta}
        className={`fixed z-40 bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl flex items-center gap-2 p-2 rounded-full border border-rule bg-paper2/95 backdrop-blur shadow-2xl transition-all duration-300 ${stickyCta ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'}`}
      >
        <Link2 size={16} className="ml-3 text-muted shrink-0 hidden sm:block" />
        <input
          type="url"
          value={heroUrl}
          onChange={(e) => setHeroUrl(e.target.value)}
          placeholder="paste a video link"
          tabIndex={stickyCta ? 0 : -1}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm text-ink placeholder:text-muted px-2"
          aria-label="Video link"
        />
        <button type="submit" tabIndex={stickyCta ? 0 : -1} className="btn-primary whitespace-nowrap rounded-full text-sm">
          get free clips <ArrowRight size={14} />
        </button>
      </form>

      {/* Footer — Ft5 Statement */}
      <footer className="border-t border-rule py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <p className="font-display text-3xl md:text-5xl lowercase text-ink tracking-tight mb-10">clip it before it scrolls past.</p>
          <nav aria-label="Guides and comparisons" className="border-t border-rule pt-6 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm lowercase text-muted">
            <a href="/free-ai-clip-generator" className="hover:text-ink transition-colors">free ai clip generator</a>
            <a href="/tools" className="hover:text-ink transition-colors">free tools</a>
            <a href="/youtube-transcript-generator" className="hover:text-ink transition-colors">youtube transcript generator</a>
            <a href="/youtube-tag-generator" className="hover:text-ink transition-colors">youtube tag generator</a>
            <a href="/video-aspect-ratio-converter" className="hover:text-ink transition-colors">video to 9:16 converter</a>
            <a href="/auto-clip" className="hover:text-ink transition-colors">auto clip</a>
            <a href="/youtube-automation" className="hover:text-ink transition-colors">youtube automation</a>
            <a href="/platforms" className="hover:text-ink transition-colors">all platforms</a>
            <a href="/use-cases" className="hover:text-ink transition-colors">use cases</a>
            <a href="/how-to" className="hover:text-ink transition-colors">guides</a>
            <a href="/platforms/youtube"className="hover:text-ink transition-colors">youtube clip maker</a>
            <a href="/platforms/youtube-shorts" className="hover:text-ink transition-colors">youtube shorts maker</a>
            <a href="/platforms/tiktok" className="hover:text-ink transition-colors">tiktok clip maker</a>
            <a href="/platforms/instagram-reels" className="hover:text-ink transition-colors">ai reel generator</a>
            <a href="/platforms/twitch" className="hover:text-ink transition-colors">twitch clip maker</a>
            <a href="/platforms/kick" className="hover:text-ink transition-colors">kick clip maker</a>
            <a href="/auto-reframe" className="hover:text-ink transition-colors">auto reframe</a>
            <a href="/use-cases/sermons" className="hover:text-ink transition-colors">sermon clip maker</a>
            <a href="/how-to/clip-a-youtube-video" className="hover:text-ink transition-colors">how to clip a youtube video</a>
            <a href="/open-source-video-clipper" className="hover:text-ink transition-colors">open source video clipper</a>
            <a href="/self-hosted-ai-clip-maker" className="hover:text-ink transition-colors">self-hosted ai clip maker</a>
            <a href="/podcast-to-shorts" className="hover:text-ink transition-colors">podcast clips</a>
            <a href="/youtube-to-shorts-converter" className="hover:text-ink transition-colors">youtube to shorts</a>
            <a href="/how-openshorts-works" className="hover:text-ink transition-colors">how it works</a>
            <a href="/alternatives" className="hover:text-ink transition-colors">alternatives</a>
            <a href="/free-ai-clipping-tools-compared" className="hover:text-ink transition-colors">free ai clipping tools compared</a>
            <a href="/alternativas" className="hover:text-ink transition-colors">alternativas</a>
            <a href="/alternatives/opus-clip" className="hover:text-ink transition-colors">vs opus clip</a>
            <a href="/opus-clip-pricing" className="hover:text-ink transition-colors">opus clip pricing</a>
            <a href="/opus-ai" className="hover:text-ink transition-colors">opus ai</a>
            <a href="/vizard-ai" className="hover:text-ink transition-colors">vizard ai</a>
            <a href="/vizard-ai-video-to-text" className="hover:text-ink transition-colors">vizard ai video to text</a>
            <a href="/alternatives/vidyo-ai" className="hover:text-ink transition-colors">vidyo ai (quso)</a>
            <a href="/alternatives/2short" className="hover:text-ink transition-colors">2short ai</a>
            <a href="/alternatives/sendshort" className="hover:text-ink transition-colors">sendshort</a>
            <a href="/submagic-reviews" className="hover:text-ink transition-colors">submagic review</a>
            <a href="/mcp" className="hover:text-ink transition-colors">mcp server & api</a>
            <a href="/automate-shorts-api" className="hover:text-ink transition-colors">automate shorts</a>
            <a href="/n8n-youtube-shorts-automation" className="hover:text-ink transition-colors">n8n workflow</a>
          </nav>
          <div className="border-t border-rule pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo-openshorts.png" alt="Clarity" className="w-6 h-6" />
              <span className="text-sm text-muted">Clarity — Free Open Source AI Clip Generator</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm lowercase text-muted">
              <a href="#features" className="hover:text-ink transition-colors">Features</a>
              <a href="#faq" className="hover:text-ink transition-colors">FAQ</a>
              <a href="/terms" className="hover:text-ink transition-colors whitespace-nowrap">Terms</a>
              <a href="/privacy" className="hover:text-ink transition-colors whitespace-nowrap">Privacy</a>
              <a href="/legal-notice" className="hover:text-ink transition-colors whitespace-nowrap">Legal Notice</a>
              <a href="/report-content" className="hover:text-ink transition-colors whitespace-nowrap">Report Content</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
