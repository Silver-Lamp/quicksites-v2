'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowUpRight, Eye, EyeOff, GripVertical } from 'lucide-react';
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

type FeedData = { sites: ShowcaseSite[]; displayMode: ShowcaseDisplayMode };

const CACHE_KEY = 'qs_showcase_cache_v3';

function readCache(): FeedData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Ignore empty caches so a bad/transient empty result can't suppress the row.
    if (!parsed || !Array.isArray(parsed.sites) || parsed.sites.length === 0) return null;
    return {
      sites: parsed.sites,
      displayMode: isShowcaseMode(parsed.displayMode) ? parsed.displayMode : DEFAULT_SHOWCASE_MODE,
    };
  } catch {
    return null;
  }
}

function writeCache(data: FeedData) {
  try {
    // Never cache an empty list (would suppress the row on the next load).
    if (!data.sites.length) return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* quota/private mode — non-fatal */
  }
}

/**
 * "Built with QuickSites" — a single horizontally-scrolling row of real
 * published sites. Hydrates instantly from a local cache (then revalidates),
 * shows a loading skeleton on the very first visit, follows the admin-chosen
 * display mode, and lets admins drag to reorder + hide/unhide (all persisted).
 */
export default function SiteShowcase({ initialData }: { initialData?: FeedData }) {
  // Seed from server-rendered data when available, so the row is in the initial
  // HTML for everyone (incl. unauthenticated users) without a client fetch.
  const [data, setData] = useState<FeedData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const isAdmin = useIsAdmin();

  const sites = data?.sites ?? [];
  const mode = data?.displayMode ?? DEFAULT_SHOWCASE_MODE;

  useEffect(() => {
    let active = true;

    if (initialData) {
      writeCache(initialData); // keep the local cache warm
    } else {
      // no SSR data → instant paint from cache (if any)
      const cached = readCache();
      if (cached && active) {
        setData(cached);
        setLoading(false);
      }
    }

    // revalidate in the background
    fetch('/api/public/showcase')
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const fresh: FeedData = {
          sites: Array.isArray(d?.sites) ? d.sites : [],
          displayMode: isShowcaseMode(d?.displayMode) ? d.displayMode : DEFAULT_SHOWCASE_MODE,
        };
        // Don't blank a good list with an empty refresh (transient/server hiccup).
        setData((prev) =>
          fresh.sites.length === 0 && prev && prev.sites.length > 0
            ? { ...prev, displayMode: fresh.displayMode }
            : fresh
        );
        writeCache(fresh);
      })
      .catch(() => {
        /* keep SSR data / cache */
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function update(next: FeedData) {
    setData(next);
    writeCache(next);
  }

  async function changeMode(nextMode: ShowcaseDisplayMode) {
    if (!data) return;
    const prev = data;
    update({ ...data, displayMode: nextMode });
    try {
      const res = await fetch('/api/admin/site-settings/showcase-mode', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: nextMode }),
      });
      if (!res.ok) update(prev);
    } catch {
      update(prev);
    }
  }

  async function toggleHide(slug: string, hidden: boolean) {
    if (!data) return;
    const prev = data;
    update({ ...data, sites: data.sites.map((s) => (s.slug === slug ? { ...s, hidden } : s)) });
    try {
      const res = await fetch('/api/admin/site-settings/showcase-hidden', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, hidden }),
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      update(prev);
    }
  }

  async function persistOrder(orderedSlugs: string[]) {
    try {
      await fetch('/api/admin/site-settings/showcase-order', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ order: orderedSlugs }),
      });
    } catch {
      /* best-effort; next load revalidates */
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    if (!data) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = data.sites.findIndex((s) => s.slug === active.id);
    const to = data.sites.findIndex((s) => s.slug === over.id);
    if (from < 0 || to < 0) return;
    const nextSites = arrayMove(data.sites, from, to);
    update({ ...data, sites: nextSites });
    persistOrder(nextSites.map((s) => s.slug));
  }

  // ---- loading skeleton (first visit, no cache yet) ----
  if (loading && sites.length === 0) {
    return (
      <section className="relative z-10 w-full border-t border-zinc-800/70">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-2xl md:text-3xl font-semibold">Built with QuickSites</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">Loading live sites…</p>
          <div className="mt-8 -mx-6 flex gap-5 overflow-hidden px-6 pb-4" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-72 shrink-0">
                <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
                  <div className="aspect-[16/10] w-full animate-pulse bg-zinc-800/70" />
                  <div className="space-y-2 p-4">
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-800" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-800/70" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const rowSites = isAdmin ? sites : sites.filter((s) => !s.hidden);
  if (rowSites.length === 0) return null;

  const Row = (
    <div className="mt-8 -mx-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4">
      {rowSites.map((s) =>
        isAdmin ? (
          <SortableShowcaseCard
            key={`${s.slug}-${mode}`}
            site={s}
            mode={mode}
            onToggleHide={() => toggleHide(s.slug, !s.hidden)}
          />
        ) : (
          <div key={`${s.slug}-${mode}`} className="w-72 shrink-0 snap-start">
            <ShowcaseCard site={s} mode={mode} />
          </div>
        )
      )}
    </div>
  );

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
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">Display (admin) · drag to reorder</span>
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

        {isAdmin ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={rowSites.map((s) => s.slug)} strategy={horizontalListSortingStrategy}>
              {Row}
            </SortableContext>
          </DndContext>
        ) : (
          Row
        )}
      </div>
    </section>
  );
}

function SortableShowcaseCard({
  site: s,
  mode,
  onToggleHide,
}: {
  site: ShowcaseSite;
  mode: ShowcaseDisplayMode;
  onToggleHide: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.slug });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : undefined };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative w-72 shrink-0 snap-start ${s.hidden ? 'opacity-45' : ''}`}
    >
      <ShowcaseCard site={s} mode={mode} />

      <button
        onClick={onToggleHide}
        title={s.hidden ? 'Show in showcase' : 'Hide from showcase'}
        className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-zinc-950/80 px-2 py-1 text-[11px] font-medium text-white backdrop-blur transition hover:bg-zinc-800"
      >
        {s.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        {s.hidden ? 'Hidden' : 'Hide'}
      </button>

      <button
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        className="absolute right-2 top-2 z-10 inline-flex cursor-grab items-center rounded-md bg-zinc-950/80 px-1.5 py-1 text-white backdrop-blur transition hover:bg-zinc-800 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
    </div>
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
