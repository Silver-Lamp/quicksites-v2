'use client';

// AisleAsk Ops client — two workflows on the catalog-gig pool:
//   • Plan & sweep: sweep a city for catalogable stores (Google Places) → select → seed gigs.
//   • Coverage: manage the gig pool by status, and cross-post gigs to recruit taskers.
// Cross-posting is ASSISTED (generate content + open the form; a human submits) — no headless
// posting to Marketplace/Craigslist (no API + against ToS). See docs/AISLEASK_OPS_PLAN.md.

import * as React from 'react';
import { STORE_CATEGORIES, defaultCategoryKeys } from '@/lib/aisleask/storeCategories';

type Candidate = {
  placeId: string;
  store_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  types: string[];
};

type GigPost = { id: string; channel: string; posted_at: string; url: string | null };
type Gig = {
  id: string;
  store_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  status: 'open' | 'claimed' | 'completed';
  source: string;
  notes: string | null;
  created_at: string;
  posts: GigPost[];
};
type Counts = { open: number; claimed: number; completed: number; total: number };

const CHANNEL_LABELS: Record<string, string> = {
  craigslist: 'Craigslist',
  facebook_marketplace: 'FB Marketplace',
  facebook_page: 'FB Page/Share',
  gigs_page: 'Our gigs page',
  email: 'Email',
  sms: 'SMS',
  other: 'Other',
};

export default function AisleAskClient() {
  const [tab, setTab] = React.useState<'plan' | 'coverage'>('plan');
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-neutral-200">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">🧺 AisleAsk Ops</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Plan which stores to catalog, seed them as gigs, and cross-post to recruit taskers.
        </p>
      </header>

      <div className="mb-6 flex gap-2">
        <TabBtn active={tab === 'plan'} onClick={() => setTab('plan')}>
          Plan &amp; sweep
        </TabBtn>
        <TabBtn active={tab === 'coverage'} onClick={() => setTab('coverage')}>
          Coverage &amp; cross-post
        </TabBtn>
      </div>

      {tab === 'plan' ? <PlanTab onSeeded={() => setTab('coverage')} /> : <CoverageTab />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        active ? 'bg-sky-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------- Plan & sweep ------------------------------- */

function PlanTab({ onSeeded }: { onSeeded: () => void }) {
  const [city, setCity] = React.useState('');
  const [region, setRegion] = React.useState('');
  const [radiusKm, setRadiusKm] = React.useState(5);
  const [cats, setCats] = React.useState<Set<string>>(new Set(defaultCategoryKeys()));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [candidates, setCandidates] = React.useState<Candidate[] | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [seedMsg, setSeedMsg] = React.useState<string | null>(null);

  const toggleCat = (k: string) =>
    setCats((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const sweep = async () => {
    setBusy(true);
    setError(null);
    setSeedMsg(null);
    setCandidates(null);
    try {
      const res = await fetch('/api/admin/aisleask/sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          region,
          radiusMeters: Math.round(radiusKm * 1000),
          categoryKeys: [...cats],
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Sweep failed.');
      setCandidates(j.candidates as Candidate[]);
      setSelected(new Set((j.candidates as Candidate[]).map((c) => c.placeId)));
    } catch (e: any) {
      setError(e?.message || 'Sweep failed.');
    } finally {
      setBusy(false);
    }
  };

  const seed = async () => {
    if (!candidates) return;
    const chosen = candidates.filter((c) => selected.has(c.placeId));
    if (!chosen.length) return;
    setBusy(true);
    setError(null);
    setSeedMsg(null);
    try {
      const res = await fetch('/api/admin/aisleask/gigs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gigs: chosen }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Could not create gigs.');
      setSeedMsg(
        `Created ${j.created} gig${j.created === 1 ? '' : 's'}${j.skipped ? ` · skipped ${j.skipped} already-seeded` : ''}.`
      );
      setCandidates(null);
      setSelected(new Set());
    } catch (e: any) {
      setError(e?.message || 'Could not create gigs.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-400">
          Sweep for stores
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-neutral-400">City</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Austin"
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm">
            <span className="text-neutral-400">State</span>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="TX"
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm">
            <span className="text-neutral-400">Radius: {radiusKm} km</span>
            <input
              type="range"
              min={1}
              max={50}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="mt-3 w-full"
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="text-xs text-neutral-500">Store categories</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {STORE_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleCat(c.key)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  cats.has(c.key)
                    ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                    : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={sweep}
            disabled={busy || (!city && !region)}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Sweeping…' : 'Sweep'}
          </button>
          {error && <span className="text-sm text-red-400">{error}</span>}
          {seedMsg && <span className="text-sm text-emerald-400">{seedMsg}</span>}
        </div>
      </section>

      {candidates && (
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-400">
              {candidates.length} stores found · {selected.size} selected
            </h2>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelected(new Set(candidates.map((c) => c.placeId)))}
                className="text-sky-400 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-neutral-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <ul className="mt-4 max-h-96 space-y-1 overflow-y-auto">
            {candidates.map((c) => {
              const on = selected.has(c.placeId);
              return (
                <li key={c.placeId}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm hover:border-neutral-700">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setSelected((s) => {
                          const n = new Set(s);
                          n.has(c.placeId) ? n.delete(c.placeId) : n.add(c.placeId);
                          return n;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-white">{c.store_name}</span>
                      <span className="ml-2 truncate text-xs text-neutral-500">
                        {c.address || c.location_label || '—'}
                      </span>
                    </span>
                    {Number.isFinite(c.latitude) && Number.isFinite(c.longitude) && (
                      <span className="shrink-0 text-xs text-emerald-500">📍</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={seed}
            disabled={busy || selected.size === 0}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Create {selected.size} cataloging gig{selected.size === 1 ? '' : 's'}
          </button>
          <button
            type="button"
            onClick={onSeeded}
            className="ml-3 text-xs text-neutral-500 hover:underline"
          >
            View coverage →
          </button>
        </section>
      )}
    </div>
  );
}

/* -------------------------------- Coverage --------------------------------- */

function CoverageTab() {
  const [gigs, setGigs] = React.useState<Gig[]>([]);
  const [counts, setCounts] = React.useState<Counts>({
    open: 0,
    claimed: 0,
    completed: 0,
    total: 0,
  });
  const [status, setStatus] = React.useState<'all' | 'open' | 'claimed' | 'completed'>('all');
  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (status !== 'all') p.set('status', status);
      if (q.trim()) p.set('q', q.trim());
      const res = await fetch(`/api/admin/aisleask/gigs?${p}`, { cache: 'no-store' });
      const j = await res.json();
      if (res.ok) {
        setGigs(j.gigs as Gig[]);
        setCounts(j.counts as Counts);
      }
    } finally {
      setLoading(false);
    }
  }, [status, q]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const setGigStatus = async (id: string, newStatus: 'open' | 'completed') => {
    const res = await fetch(`/api/admin/aisleask/gigs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {(['all', 'open', 'claimed', 'completed'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
              status === s
                ? 'bg-sky-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            {s}
            {s !== 'all' ? ` (${counts[s]})` : ` (${counts.total})`}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search store / area…"
          className="ml-auto w-56 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white"
        />
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : gigs.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No gigs yet. Sweep a city on the Plan tab to seed some.
        </p>
      ) : (
        <ul className="space-y-2">
          {gigs.map((g) => (
            <li key={g.id} className="rounded-xl border border-neutral-800 bg-neutral-900/60">
              <div className="flex items-center gap-3 p-3">
                <StatusDot status={g.status} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{g.store_name}</div>
                  <div className="truncate text-xs text-neutral-500">
                    {g.address || g.location_label || '—'}
                  </div>
                </div>
                {g.posts.length > 0 && (
                  <span className="shrink-0 text-xs text-neutral-500">
                    posted:{' '}
                    {g.posts
                      .map((p) => CHANNEL_LABELS[p.channel] || p.channel)
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .join(', ')}
                  </span>
                )}
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => (e === g.id ? null : g.id))}
                    className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                  >
                    Cross-post
                  </button>
                  {g.status === 'completed' ? (
                    <button
                      type="button"
                      onClick={() => setGigStatus(g.id, 'open')}
                      className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 hover:bg-neutral-800"
                    >
                      Reopen
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setGigStatus(g.id, 'completed')}
                      className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 hover:bg-neutral-800"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
              {expanded === g.id && <CrossPostPanel gig={g} onPosted={load} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: Gig['status'] }) {
  const color =
    status === 'open' ? 'bg-emerald-500' : status === 'claimed' ? 'bg-amber-500' : 'bg-neutral-600';
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} title={status} />;
}

/* ------------------------------ Cross-post panel ------------------------------ */

type PostContent = {
  channel: string;
  title: string;
  body: string;
  url: string;
  hints: Record<string, string>;
};
type Launchers = { craigslist: string; facebookPageComposer: string; gigPublic: string };

function CrossPostPanel({ gig, onPosted }: { gig: Gig; onPosted: () => void }) {
  const [channel, setChannel] = React.useState('craigslist');
  const [payNote, setPayNote] = React.useState('');
  const [content, setContent] = React.useState<PostContent | null>(null);
  const [launchers, setLaunchers] = React.useState<Launchers | null>(null);
  const [qr, setQr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);

  const gen = React.useCallback(async () => {
    setBusy(true);
    try {
      const p = new URLSearchParams({ channel });
      if (payNote.trim()) p.set('payNote', payNote.trim());
      const res = await fetch(`/api/admin/aisleask/gigs/${gig.id}/post?${p}`, {
        cache: 'no-store',
      });
      const j = await res.json();
      if (res.ok) {
        setContent(j.content);
        setLaunchers(j.launchers);
        setQr(j.qr);
      }
    } finally {
      setBusy(false);
    }
  }, [gig.id, channel, payNote]);
  React.useEffect(() => {
    void gen();
  }, [gen]);

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const markPosted = async () => {
    const res = await fetch(`/api/admin/aisleask/gigs/${gig.id}/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel }),
    });
    if (res.ok) onPosted();
  };

  return (
    <div className="border-t border-neutral-800 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white"
        >
          {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          value={payNote}
          onChange={(e) => setPayNote(e.target.value)}
          placeholder="Pay/comp note (honest — e.g. 'Pilot, unpaid' or '$X/store')"
          className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white"
        />
      </div>

      <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
        Assisted posting: this generates the post + opens the form. FB Marketplace &amp; Craigslist
        have no posting API and forbid bots — <b>you</b> submit. Our gigs page / feed and an FB Page
        share are the automatable channels.
      </p>

      {busy && !content ? (
        <p className="text-xs text-neutral-500">Generating…</p>
      ) : (
        content && (
          <div className="space-y-3">
            <Field
              label="Title"
              value={content.title}
              onCopy={() => copy('Title', content.title)}
              copied={copied === 'Title'}
            />
            <Field
              label="Body"
              value={content.body}
              multiline
              onCopy={() => copy('Body', content.body)}
              copied={copied === 'Body'}
            />
            <div className="text-xs text-neutral-500">
              Category hint: {content.hints.craigslistCategory} ·{' '}
              <span className="text-sky-400">{content.url}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {launchers && (
                <>
                  <a
                    href={launchers.craigslist}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
                  >
                    Open Craigslist ↗
                  </a>
                  <a
                    href={launchers.facebookPageComposer}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
                  >
                    Share to Facebook ↗
                  </a>
                  <a
                    href={launchers.gigPublic}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
                  >
                    Preview gig page ↗
                  </a>
                </>
              )}
              <button
                type="button"
                onClick={markPosted}
                className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Mark posted to {CHANNEL_LABELS[channel]}
              </button>
            </div>

            {qr && (
              <div className="flex items-center gap-3 pt-1">
                <img src={qr} alt="Gig QR" className="h-20 w-20 rounded bg-white p-1" />
                <span className="text-xs text-neutral-500">
                  QR to the gig page — drop into a printed flyer or image post.
                </span>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

function Field({
  label,
  value,
  multiline,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {label}
        </span>
        <button type="button" onClick={onCopy} className="text-xs text-sky-400 hover:underline">
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      {multiline ? (
        <pre className="whitespace-pre-wrap rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-200">
          {value}
        </pre>
      ) : (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200">
          {value}
        </div>
      )}
    </div>
  );
}
