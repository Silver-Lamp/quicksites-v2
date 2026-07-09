'use client';

// Design panel: pick a curated theme (restyle) or shuffle. Applying stamps
// data.meta.theme (accent/font/tint/radius/surface/layout) + color_mode — a
// non-destructive restyle that keeps the site's content. Live-previews via the
// editor's apply path. See docs/THEME_SYSTEM_PLAN.md (Phase C).

import * as React from 'react';
import { Shuffle, Check } from 'lucide-react';
import { CURATED_THEMES, type CuratedTheme } from '@/lib/theme/curatedThemes';
import { getFontPairing } from '@/lib/theme/fontPairings';
import { ACCENT_HSL } from '@/lib/theme/accentHsl';

function accentCss(token: string): string {
  const t = ACCENT_HSL[token] || ACCENT_HSL['sky-500'] || '199 89% 48%';
  const [h, s, l] = t.split(/\s+/);
  return `hsl(${h} ${s} ${l})`;
}

export function ThemeShufflePanel({
  currentId,
  onApply,
  onShuffle,
}: {
  currentId?: string | null;
  onApply: (t: CuratedTheme) => void;
  onShuffle: () => void;
}) {
  return (
    <div className="w-[320px] rounded-lg border border-white/10 bg-zinc-900/95 p-3 text-white shadow-2xl backdrop-blur">
      <div className="mb-2.5 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Theme</div>
          <div className="text-[11px] text-zinc-400">Restyle without changing your content.</div>
        </div>
        <button
          type="button"
          onClick={onShuffle}
          className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-2.5 py-1.5 text-xs font-medium hover:bg-purple-500"
          title="Apply a random theme"
        >
          <Shuffle className="h-3.5 w-3.5" /> Shuffle
        </button>
      </div>

      <div className="grid max-h-[300px] grid-cols-3 gap-2 overflow-auto pr-0.5">
        {CURATED_THEMES.map((t) => {
          const active = t.id === currentId;
          const pair = getFontPairing(t.fontPair);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onApply(t)}
              className={`relative rounded-md border p-1 text-left transition ${
                active ? 'border-sky-400 ring-1 ring-sky-400/40' : 'border-white/10 hover:border-white/30'
              }`}
              title={`${t.name} — ${t.category}`}
            >
              <div
                className="flex h-10 items-end justify-end rounded p-1"
                style={{ backgroundImage: `linear-gradient(135deg, ${accentCss(t.accentColor)}, ${accentCss(t.accent2Color)})` }}
              >
                {active ? <Check className="h-3.5 w-3.5 text-white drop-shadow" /> : null}
              </div>
              <div className="mt-1 truncate text-[11px] font-medium">{t.name}</div>
              <div className="truncate text-[10px] text-zinc-400">
                {t.darkMode === 'dark' ? '🌙' : '☀'} {pair ? pair.name.split(' · ')[0] : t.fontFamily}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
