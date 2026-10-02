'use client';

// Design panel: pick a curated theme (restyle) or shuffle. Applying stamps
// data.meta.theme (accent/font/tint/radius/surface/layout) + color_mode — a
// non-destructive restyle that keeps the site's content. Live-previews via the
// editor's apply path. See docs/THEME_SYSTEM_PLAN.md (Phase C).

import * as React from 'react';
import { Shuffle, Check, Pin } from 'lucide-react';
import { CURATED_THEMES, type CuratedTheme } from '@/lib/theme/curatedThemes';
import { getFontPairing } from '@/lib/theme/fontPairings';
import { ACCENT_HSL } from '@/lib/theme/accentHsl';

function accentCss(token: string): string {
  const t = ACCENT_HSL[token] || ACCENT_HSL['sky-500'] || '199 89% 48%';
  const [h, s, l] = t.split(/\s+/);
  return `hsl(${h} ${s} ${l})`;
}

/**
 * Pin the typeface you are looking at as the default for this industry.
 *
 * ⚠️ IT DOES NOT RETHEME EXISTING SITES, and the control says so. The whole point is that the
 * person with the taste is in the editor looking at a real site, not editing a TypeScript table
 * and waiting for a deploy — but "make this the default" reads like "apply this everywhere",
 * and it must not be mistaken for that.
 */
function PinIndustryFont({ industry, fontPair, pairName }: { industry: string; fontPair: string; pairName: string }) {
  const [state, setState] = React.useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [msg, setMsg] = React.useState<string | null>(null);

  async function pin() {
    setState('saving');
    try {
      const res = await fetch('/api/admin/theme/industry-font-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, fontPair }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setState('error');
        // ⚠️ A 403 here means not-an-admin, which is the expected answer for most users rather
        // than a fault — say what happened instead of "failed".
        setMsg(res.status === 403 ? 'Admins only.' : j?.error ?? 'Could not pin.');
        return;
      }
      setState('done');
      setMsg(`New ${industry} sites will use ${j.name ?? fontPair}.`);
    } catch (e: any) {
      setState('error');
      setMsg(e?.message ?? 'Could not pin.');
    }
  }

  return (
    <div className="mt-2.5 border-t border-white/10 pt-2.5">
      <button
        type="button"
        onClick={pin}
        disabled={state === 'saving'}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-white/35 disabled:opacity-50"
        title={`Make ${pairName} the default typeface for ${industry} sites`}
      >
        <Pin className="h-3 w-3" />
        {state === 'saving' ? 'Pinning…' : `Pin ${pairName.split(' · ')[0]} for ${industry}`}
      </button>
      <p className={`mt-1 text-[10px] ${state === 'error' ? 'text-amber-300' : 'text-zinc-500'}`}>
        {msg ?? 'Sets the default for NEW sites in this industry. Nothing already built changes.'}
      </p>
    </div>
  );
}

export function ThemeShufflePanel({
  currentId,
  onApply,
  onShuffle,
  industry,
  currentFontPair,
}: {
  currentId?: string | null;
  onApply: (t: CuratedTheme) => void;
  onShuffle: () => void;
  /** This site's industry — the pin control is hidden without one. */
  industry?: string | null;
  /** The pairing currently applied, which is what gets pinned. */
  currentFontPair?: string | null;
}) {
  const pinnable = getFontPairing(currentFontPair ?? '');
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

      {/* ⚠️ Hidden without BOTH an industry and a resolved pairing: pinning "undefined" for ""
          would write a junk key that then has to be cleaned out of site_settings by hand. */}
      {industry && pinnable ? (
        <PinIndustryFont industry={industry} fontPair={pinnable.id} pairName={pinnable.name} />
      ) : null}
    </div>
  );
}
