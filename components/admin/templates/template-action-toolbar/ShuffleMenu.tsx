'use client';

// components/admin/templates/template-action-toolbar/ShuffleMenu.tsx
//
// The bottom-right "Shuffle" control. Primary tap = Shuffle all (new layout + palette
// + fonts in one go); the caret opens a menu to shuffle a single axis. Every option is
// content-safe (restyles only) and persists through the normal commit path.

import { useEffect, useRef, useState } from 'react';
import { Shuffle, ChevronUp, Palette, Type, LayoutGrid, SunMoon, Sparkles, Layers } from 'lucide-react';

export type ShuffleMenuProps = {
  onShuffleAll: () => void;
  onShuffleTheme: () => void;
  onShuffleLayout: () => void;
  onShufflePalette: () => void;
  onShuffleFonts: () => void;
  onToggleMode: () => void;
  colorMode: 'light' | 'dark';
};

export default function ShuffleMenu({
  onShuffleAll,
  onShuffleTheme,
  onShuffleLayout,
  onShufflePalette,
  onShuffleFonts,
  onToggleMode,
  colorMode,
}: ShuffleMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  const items: { icon: React.ReactNode; label: string; hint: string; onClick: () => void }[] = [
    { icon: <Sparkles className="h-4 w-4" />, label: 'Theme', hint: 'Colors, fonts & feel', onClick: run(onShuffleTheme) },
    { icon: <LayoutGrid className="h-4 w-4" />, label: 'Layout', hint: 'Hero, sections & rhythm', onClick: run(onShuffleLayout) },
    { icon: <Palette className="h-4 w-4" />, label: 'Palette', hint: 'Accent colors', onClick: run(onShufflePalette) },
    { icon: <Type className="h-4 w-4" />, label: 'Fonts', hint: 'Typography pairing', onClick: run(onShuffleFonts) },
    { icon: <SunMoon className="h-4 w-4" />, label: colorMode === 'dark' ? 'Switch to light' : 'Switch to dark', hint: 'Light / dark mode', onClick: run(onToggleMode) },
  ];

  return (
    <div ref={rootRef} className="fixed bottom-24 right-6 z-[2147483647] pointer-events-auto">
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-60 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur">
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Shuffle just…</div>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={it.onClick}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-zinc-100 transition hover:bg-purple-600/20"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-fuchsia-300">{it.icon}</span>
              <span className="min-w-0">
                <span className="block font-medium leading-tight">{it.label}</span>
                <span className="block text-xs text-zinc-500">{it.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="inline-flex items-stretch overflow-hidden rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 shadow-2xl ring-1 ring-white/20">
        <button
          type="button"
          onClick={onShuffleAll}
          title="Shuffle everything — new layout, palette & fonts (keeps your content)"
          aria-label="Shuffle everything"
          className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
        >
          <Shuffle className="h-5 w-5" />
          Shuffle
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Shuffle a single thing"
          aria-label="Shuffle options"
          aria-expanded={open}
          className="inline-flex items-center border-l border-white/20 px-2.5 text-white transition hover:bg-white/10 active:scale-95"
        >
          {open ? <ChevronUp className="h-4 w-4 rotate-180" /> : <Layers className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
