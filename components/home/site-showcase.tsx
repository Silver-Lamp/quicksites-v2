'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Eye, EyeOff } from 'lucide-react';
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
  hidden: boolean;
};

/**
 * "Built with QuickSites" — a single horizontally-scrolling row of real
 * published sites. The card visual follows the admin-chosen display mode
 * (thumbnail / OG / hero / logo). Admins can hide/unhide individual sites
 * (persisted site-wide); visitors never see hidden ones.
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
    setMode(next);
    try {
      const res = await fetch('/api/admin/site-settings/showcase-mode', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      });
      if (!res.ok) setMode(prev);
    } catch {
      setMode(prev);
    }
  }

  async function toggleHide(slug: string, hidden: boolean) {
    setSites((prev) => (prev ? prev.map((s) => (s.slug === slug ? { ...s, hidden } : s)) : prev));
    try {
      const res = await fetch('/api/admin/site-settings/showcase-hidden', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, hidden }),
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      setSites((prev) => (prev ? prev.map((s) => (s.slug === slug ? { ...s, hidden: !hidden } : s)) : prev));
    }
  }

  if (!sites) return null;
  const visible = isAdmin ? sites : sites.filter((s) => !s.hidden);
  if (visible.length === 0) return null;

  return (
    <section className="relative z-10 w-full border-t border-zinc-800/70">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold">Built with QuickSites</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Real businesses, live on QuickSites. Scroll to explore — click any site to view it live.
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

        {/* single horizontally-scrolling row */}
        <div className="mt-8 -mx-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4">
          {visible.map((s) => (
            <div
              key={`${s.slug}-${mode}`}
              className={`relative w-72 shrink-0 snap-start ${s.hidden ? 'opacity-45' : ''}`}
            >
              <ShowcaseCard site={s} mode={mode} />
              {isAdmin && (
                <button
                  onClick={() => toggleHide(s.slug, !s.hidden)}
                  title={s.hidden ? 'Show in showcase' : 'Hide from showcase'}
                  className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-zinc-950/80 px-2 py-1 text-[11px] font-medium text-white backdrop-blur transition hover:bg-zinc-800"
                >
                  {s.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {s.hidden ? 'Hidden' : 'Hide'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowcaseCard({ site: s, mode }: { site: ShowcaseSite; mode: ShowcaseDisplayMode }) {
  const [imgOk, setImgOk] = useState(true);
  const [logoOk, setLogoOk] = useState(Boolean(s.logoUrl));

  const generated = mode === 'thumbnail' || mode === 'og';
  const imageSrc =
    mode === 'thumbnail'
      ? `/api/public/showcase/${encodeURIComponent(s.slug)}/thumb`
      : mode === 'og'
      ? `/og/${encodeURIComponent(s.slug)}`
      : mode === 'hero'
      ? s.heroUrl
      : null;

  return (
    <a
      href={s.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 transition hover:border-sky-500/50 hover:bg-sky-500/[0.03]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-800/60">
        {mode === 'logo' ? (
          s.logoUrl && logoOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
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
