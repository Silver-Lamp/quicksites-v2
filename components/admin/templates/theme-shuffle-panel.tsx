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
 * Add the typeface you are looking at to this industry's pool.
 *
 * ⚠️ A POOL, NOT A SINGLE FACE. One typeface per industry makes every towing site in a town
 * identical — the "obviously a template" tell. Approve two or three that suit the trade and new
 * sites spread across them deterministically: varied to a visitor, repeatable for us.
 *
 * ⚠️ IT DOES NOT RETHEME EXISTING SITES, and the control says so. "Make this the default" reads
 * like "apply this everywhere", and it must not be mistaken for that.
 */
function IndustryFontPool({ industry, fontPair, pairName }: { industry: string; fontPair: string; pairName: string }) {
  const [pool, setPool] = React.useState<string[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  // Load this industry's pool once the panel opens, so the button can say add vs remove.
  React.useEffect(() => {
    let off = false;
    fetch('/api/admin/theme/industry-font-pin')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!off && j?.ok) setPool(j.pins?.[industry] ?? []); })
      .catch(() => { /* not an admin, or offline — the control stays quiet */ });
    return () => { off = true; };
  }, [industry]);

  const inPool = !!pool?.includes(fontPair);

  async function send(op: 'add' | 'remove') {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/theme/industry-font-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, fontPair, op }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        // ⚠️ A 403 is "not an admin", the expected answer for most users — not a fault.
        setMsg(res.status === 403 ? 'Admins only.' : j?.error ?? 'Could not save.');
        return;
      }
      setPool(j.pool ?? []);
      setMsg(j.note ?? null);
    } catch (e: any) {
      setMsg(e?.message ?? 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2.5 border-t border-white/10 pt-2.5">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
        {industry} typeface pool
      </div>

      {pool?.length ? (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {pool.map((id) => (
            <span
              key={id}
              className={`rounded px-1.5 py-0.5 text-[10px] ${
                id === fontPair ? 'bg-sky-500/20 text-sky-200' : 'bg-white/5 text-zinc-400'
              }`}
            >
              {getFontPairing(id)?.name?.split(' · ')[0] ?? id}
            </span>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => send(inPool ? 'remove' : 'add')}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-white/35 disabled:opacity-50"
        title={`${inPool ? 'Remove' : 'Add'} ${pairName} ${inPool ? 'from' : 'to'} the ${industry} pool`}
      >
        <Pin className="h-3 w-3" />
        {busy ? 'Saving…' : inPool
          ? `Remove ${pairName.split(' · ')[0]} from pool`
          : `Add ${pairName.split(' · ')[0]} to ${industry} pool`}
      </button>
      <p className="mt-1 text-[10px] text-zinc-500">
        {msg ?? 'New sites in this industry draw from the pool. Nothing already built changes.'}
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
        <IndustryFontPool industry={industry} fontPair={pinnable.id} pairName={pinnable.name} />
      ) : null}
    </div>
  );
}
