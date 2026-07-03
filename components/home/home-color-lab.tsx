// components/home/home-color-lab.tsx
'use client';

// A homepage color-scheme playground. Gated behind ?colorlab=1 (or ?colors=1) so
// it never shows for normal visitors. It writes CSS custom properties on <html>:
//   --qs-accent      primary accent (buttons, borders, glow, H1 gradient start)
//   --qs-accent-2    secondary accent (H1 gradient end)
//   --qs-accent-fg   text color on top of the accent (button label)
// Components that opt in read those vars with a sky-palette fallback, so the page
// looks identical when the lab is closed/absent. Live preview only — not saved.
import { useEffect, useState } from 'react';

type Scheme = { name: string; accent: string; accent2: string; fg: string };

const PRESETS: Scheme[] = [
  { name: 'Sky', accent: '#0ea5e9', accent2: '#7dd3fc', fg: '#09090b' },
  { name: 'Emerald', accent: '#10b981', accent2: '#6ee7b7', fg: '#052e16' },
  { name: 'Violet', accent: '#8b5cf6', accent2: '#c4b5fd', fg: '#faf5ff' },
  { name: 'Amber', accent: '#f59e0b', accent2: '#fcd34d', fg: '#1c1917' },
  { name: 'Rose', accent: '#f43f5e', accent2: '#fda4af', fg: '#4c0519' },
  { name: 'Cyan', accent: '#06b6d4', accent2: '#67e8f9', fg: '#083344' },
];

export default function HomeColorLab() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(true);
  const [accent, setAccent] = useState(PRESETS[0].accent);
  const [accent2, setAccent2] = useState(PRESETS[0].accent2);
  const [fg, setFg] = useState(PRESETS[0].fg);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has('colorlab') || p.has('colors')) setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const s = document.documentElement.style;
    s.setProperty('--qs-accent', accent);
    s.setProperty('--qs-accent-2', accent2);
    s.setProperty('--qs-accent-fg', fg);
  }, [enabled, accent, accent2, fg]);

  if (!enabled) return null;

  const applyPreset = (p: Scheme) => {
    setAccent(p.accent);
    setAccent2(p.accent2);
    setFg(p.fg);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open color scheme tool"
        className="fixed bottom-4 left-4 z-[60] h-12 w-12 rounded-full border border-white/15 bg-zinc-900/90 text-xl shadow-2xl backdrop-blur transition hover:border-white/40"
      >
        🎨
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[60] w-72 rounded-2xl border border-white/10 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">🎨 Color scheme</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Collapse"
          className="text-sm text-zinc-400 transition hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => applyPreset(p)}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs text-zinc-200 transition hover:border-white/40 ${
              p.accent === accent ? 'border-white/50' : 'border-white/10'
            }`}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.accent }} />
            {p.name}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <SwatchRow label="Accent" value={accent} onChange={setAccent} />
        <SwatchRow label="Accent 2" value={accent2} onChange={setAccent2} />
        <SwatchRow label="Button text" value={fg} onChange={setFg} />
      </div>

      <p className="mt-3 text-[11px] leading-snug text-zinc-500">
        Live preview only — not saved. Drives the hero title, the build card, and the CTA.
      </p>
    </div>
  );
}

function SwatchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-zinc-300">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-9 cursor-pointer rounded border border-white/10 bg-transparent p-0"
          aria-label={`${label} color picker`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="w-20 rounded border border-white/10 bg-zinc-800 px-2 py-1 font-mono text-xs text-white focus:border-white/40 focus:outline-none"
          aria-label={`${label} hex`}
        />
      </span>
    </label>
  );
}
