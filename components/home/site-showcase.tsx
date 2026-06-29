'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import {
  type ShowcaseDisplayMode,
  SHOWCASE_DISPLAY_MODES,
  SHOWCASE_MODE_LABELS,
  DEFAULT_SHOWCASE_MODE,
  isShowcaseMode,
} from '@/lib/home/showcase-helpers';

type ShowcaseSite = {
  slug: string;
  name: string;
  industry: string | null;
  heroUrl: string | null;
  logoUrl: string | null;
  href: string;
};

/**
 * "Built with QuickSites" — a curated gallery of real published sites. The card
 * visual follows the admin-chosen display mode (thumbnail / OG / hero / logo),
 * persisted site-wide. Renders nothing until loaded and nothing if empty.
 */
export default function SiteShowcase() {
  const [sites, setSites] = useState<ShowcaseSite[] | null>(null);
  const [mode, setMode] = useState<ShowcaseDisplayMode>(DEFAULT_SHOWCASE_MODE);
  const isAdmin = useIsAdmin();

  useEffect(() => {
    let active = true;
    fetch('/api/public/showcase')
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setSites(Array.isArray(d?.sites) ? d.sites : []);
        if (isShowcaseMode(d?.displayMode)) setMode(d.displayMode);
      })
      .catch(() => {
        if (active) setSites([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function changeMode(next: ShowcaseDisplayMode) {
    const prev = mode;
    setMode(next); // optimistic
    try {
      const res = await fetch('/api/admin/site-settings/showcase-mode', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      });
      if (!res.ok) setMode(prev); // revert on failure
    } catch {
      setMode(prev);
    }
  }

  if (!sites || sites.length === 0) return null;

  return (
    <section className="relative z-10 w-full border-t border-zinc-800/70">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold">Built with QuickSites</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Real businesses, live on QuickSites. Click through to see the published sites.
            </p>
          </div>

          {isAdmin && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">Display (admin)</span>
              <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5">
                {SHOWCASE_DISPLAY_MODES.map((m) => (
                  <button
                    key={m}
                    onClick={() => changeMode(m)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      mode === m ? 'bg-sky-500 text-zinc-950' : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    {SHOWCASE_MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((s) => (
            <ShowcaseCard key={`${s.slug}-${mode}`} site={s} mode={mode} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowcaseCard({ site: s, mode }: { site: ShowcaseSite; mode: ShowcaseDisplayMode }) {
  const [imgOk, setImgOk] = useState(true);
  const [logoOk, setLogoOk] = useState(Boolean(s.logoUrl));

  // Generated modes (thumbnail/OG) bake the name onto the image; raw modes
  // (hero/logo) show a text footer below the visual.
  const generated = mode === 'thumbnail' || mode === 'og';
  const imageSrc =
    mode === 'thumbnail'
      ? `/api/public/showcase/${encodeURIComponent(s.slug)}/thumb`
      : mode === 'og'
      ? `/og/${encodeURIComponent(s.slug)}`
      : mode === 'hero'
      ? s.heroUrl
      : null; // 'logo' handled separately

  // Re-key on mode so a new <img> mounts (resets onError state) when switching.
  return (
    <a
      href={s.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 transition hover:border-sky-500/50 hover:bg-sky-500/[0.03]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-800/60">
        {mode === 'logo' ? (
          s.logoUrl && logoOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`logo-${s.slug}`}
              src={s.logoUrl}
              alt={s.name}
              loading="lazy"
              onError={() => setLogoOk(false)}
              className="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-900 object-contain p-10"
            />
          ) : (
            <Placeholder name={s.name} />
          )
        ) : imageSrc && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${mode}-${s.slug}`}
            src={imageSrc}
            alt={`${s.name} — built with QuickSites`}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <Placeholder name={s.name} />
        )}

        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-zinc-950/70 px-2.5 py-1 text-xs font-medium text-sky-300 opacity-0 backdrop-blur transition group-hover:opacity-100">
          View live <ArrowUpRight className="h-3 w-3" />
        </div>
      </div>

      {!generated && (
        <div className="flex items-center gap-3 p-4">
          {s.logoUrl && mode !== 'logo' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-zinc-700 object-cover" />
          ) : null}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{s.name}</div>
            {s.industry ? <div className="truncate text-xs text-zinc-400">{s.industry}</div> : null}
          </div>
        </div>
      )}
    </a>
  );
}

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-3xl font-bold text-zinc-600">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
