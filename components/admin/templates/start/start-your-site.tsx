'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Layers, Sparkles, FilePlus2, Search, Check, Globe, Link2 } from 'lucide-react';
import { KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import BrandLoader from '@/components/brand/BrandLoader';

type Step = 'choose' | 'industry' | 'template' | 'convert';
type Starter = { slug: string; name: string; industry: string | null; heroUrl: string | null };

/** Deduped, alphabetized industry options ('other' kept last). */
const INDUSTRY_OPTIONS: Array<{ key: IndustryKey; label: string }> = (() => {
  const seen = new Set<string>();
  const opts: Array<{ key: IndustryKey; label: string }> = [];
  for (const key of Object.keys(KEY_TO_LABEL) as IndustryKey[]) {
    if (key === 'other' || seen.has(key)) continue;
    seen.add(key);
    opts.push({ key, label: KEY_TO_LABEL[key] });
  }
  opts.sort((a, b) => a.label.localeCompare(b.label));
  opts.push({ key: 'other', label: KEY_TO_LABEL['other'] ?? 'Other' });
  return opts;
})();

function toEditor(id: string) {
  // Hard-navigate so the create loader stays up until the editor paints — a soft
  // nav briefly re-exposes this page while the async /admin layout auth resolves.
  window.location.assign(`/admin/templates/${id}/edit`);
}

export default function StartYourSite() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('choose');

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {step !== 'choose' && (
          <button
            onClick={() => setStep('choose')}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to start options
          </button>
        )}

        {step === 'choose' && <ChooseStep onPick={setStep} router={router} />}
        {step === 'industry' && <IndustryStep router={router} />}
        {step === 'template' && <TemplateStep router={router} />}
        {step === 'convert' && <ConvertStep router={router} />}
      </div>
    </div>
  );
}

/* ----------------------------- Step 1: choose ----------------------------- */

function ChooseStep({
  onPick,
  router,
}: {
  onPick: (s: Step) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const cards = [
    {
      key: 'industry' as const,
      icon: Sparkles,
      title: 'Start from your industry',
      blurb: 'Pick what you do and we’ll set up a starter site — services, sections, and theme ready to edit.',
      cta: 'Choose an industry',
      onClick: () => onPick('industry'),
      highlight: true,
    },
    {
      key: 'convert' as const,
      icon: Globe,
      title: 'Convert an existing site',
      blurb: 'Already have a site? Paste its address and our AI rebuilds it here as an editable draft in seconds.',
      cta: 'Paste a URL',
      onClick: () => onPick('convert'),
      highlight: true,
    },
    {
      key: 'byo' as const,
      icon: Link2,
      title: 'I have a domain, but it’s parked',
      blurb: 'Paying for a domain that still shows “under construction”? We’ll build the site and hand you the exact DNS records — website and email both covered.',
      cta: 'Bring my domain',
      // Full nav: the flow lives outside /admin and starts with a live DNS check.
      onClick: () => window.location.assign('/bring-your-domain'),
      highlight: true,
    },
    {
      key: 'template' as const,
      icon: Layers,
      title: 'Duplicate a template',
      blurb: 'Begin from a real, polished site and make it your own.',
      cta: 'Browse templates',
      onClick: () => onPick('template'),
    },
    {
      key: 'blank' as const,
      icon: FilePlus2,
      title: 'Start blank',
      blurb: 'An empty canvas. Build every section yourself.',
      cta: 'Open blank editor',
      onClick: () => router.replace('/admin/templates/new?mode=blank'),
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Let’s build your site</h1>
      <p className="mt-2 text-zinc-400">Choose how you’d like to start. You can change anything later.</p>

      {/* 5 cards → 3-up on large screens (a 4-col grid leaves one orphan). */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={c.onClick}
            className={`group flex h-full flex-col rounded-2xl border p-6 text-left transition ${
              c.highlight
                ? 'border-sky-500/50 bg-sky-500/[0.04] hover:border-sky-400'
                : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600'
            }`}
          >
            <c.icon className={`h-7 w-7 ${c.highlight ? 'text-sky-400' : 'text-zinc-300'}`} />
            <h3 className="mt-4 text-lg font-semibold">{c.title}</h3>
            <p className="mt-1.5 flex-1 text-sm text-zinc-400">{c.blurb}</p>
            <span className="mt-4 inline-flex items-center text-sm font-medium text-sky-400">
              {c.cta} <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------- Step 2: industry ---------------------------- */

function IndustryStep({ router }: { router: ReturnType<typeof useRouter> }) {
  const [businessName, setBusinessName] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<IndustryKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDUSTRY_OPTIONS;
    return INDUSTRY_OPTIONS.filter((o) => o.label.toLowerCase().includes(q));
  }, [query]);

  async function create() {
    if (busy) return;
    setError(null);
    if (!businessName.trim()) return setError('Add your business name to continue.');
    if (!selected) return setError('Pick an industry to continue.');

    setBusy(true);
    try {
      const initial = buildIndustryStarter({ businessName, industryKey: selected });
      const res = await fetch('/api/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initial),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error || 'Could not create your site.');
      }
      const { id } = (await res.json()) as { id?: string };
      if (!id) throw new Error('Could not create your site.');
      toEditor(id);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div>
      <BrandLoader open={busy} message="Building your site…" />
      <h1 className="text-2xl font-semibold tracking-tight">Tell us about your business</h1>
      <p className="mt-2 text-zinc-400">We’ll scaffold a starter site for your industry.</p>

      <div className="mt-6 max-w-md">
        <label className="text-sm text-zinc-300" htmlFor="biz">Business name</label>
        <input
          id="biz"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
          placeholder="e.g. Grafton Towing"
          className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-sky-500"
        />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-300">Industry</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search industries"
              className="w-56 rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 pl-8 pr-3 text-sm text-white outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="mt-3 grid max-h-[44vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((o) => {
            const active = selected === o.key;
            return (
              <button
                key={o.key}
                onClick={() => setSelected(o.key)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                  active
                    ? 'border-sky-500 bg-sky-500/10 text-white'
                    : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {active && <Check className="ml-2 h-4 w-4 shrink-0 text-sky-400" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-6 text-center text-sm text-zinc-500">No industries match “{query}”.</div>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={create}
          disabled={busy}
          className="inline-flex items-center rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-zinc-950 transition hover:bg-sky-400 disabled:opacity-60"
        >
          {busy ? 'Creating your site…' : 'Create my site'}
          {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- Step: convert ------------------------------ */

// Staged status copy while the rebuild is in flight (one round-trip; these just
// make the ~10-20s wait read as progress). Mirrors components/rebuild/rebuild-tool.
const CONVERT_STAGES = [
  'Reading your current site…',
  'Understanding your business…',
  'Writing fresh copy…',
  'Assembling your new site…',
];

/** Onboarding path: paste an existing site URL → POST /api/rebuild → editor.
 *  Reuses the same AI-rebuild backend as the public /rebuild lead magnet, but
 *  lands the (already signed-in) user straight in the editor like the other steps. */
function ConvertStep({ router }: { router: ReturnType<typeof useRouter> }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, []);

  const normalizeUrl = (raw: string): string => {
    const t = raw.trim();
    if (!t) return '';
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  };

  async function convert() {
    if (busy) return;
    setError(null);
    const target = normalizeUrl(url);
    if (!target) return setError('Paste the address of the site you want to convert.');

    setBusy(true);
    setStage(0);
    stageTimer.current = setInterval(() => {
      setStage((s) => (s < CONVERT_STAGES.length - 1 ? s + 1 : s));
    }, 3500);

    try {
      const res = await fetch('/api/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json?.id) {
        throw new Error(json?.error || 'Could not convert that site. Try another URL.');
      }
      toEditor(json.id);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
      setBusy(false);
    } finally {
      if (stageTimer.current) clearInterval(stageTimer.current);
    }
  }

  return (
    <div>
      <BrandLoader open={busy} message="Rebuilding your site…" />
      <h1 className="text-2xl font-semibold tracking-tight">Convert your existing site</h1>
      <p className="mt-2 text-zinc-400">
        Paste the address of a site you already have. Our AI reads it and rebuilds it here as a fresh,
        fully-editable draft — copy, services, and layout included.
      </p>

      <div className="mt-6 max-w-lg">
        <label className="text-sm text-zinc-300" htmlFor="convert-url">Current website address</label>
        <div className="mt-1.5 flex flex-col gap-3 sm:flex-row">
          <input
            id="convert-url"
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') convert(); }}
            placeholder="yourbusiness.com"
            disabled={busy}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-sky-500"
          />
          <button
            onClick={convert}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-zinc-950 transition hover:bg-sky-400 disabled:opacity-60"
          >
            {busy ? 'Converting…' : 'Convert my site'}
            {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
          </button>
        </div>
      </div>

      {busy && (
        <p className="mt-4 text-sm text-sky-300" role="status" aria-live="polite">
          {CONVERT_STAGES[stage]}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {!busy && !error && (
        <p className="mt-4 max-w-lg text-xs text-zinc-500">
          Works with most business sites (Wix, WordPress, Squarespace, and more). You can edit everything after.
        </p>
      )}
    </div>
  );
}

/* ---------------------------- Step 3: template ---------------------------- */

function TemplateStep({ router }: { router: ReturnType<typeof useRouter> }) {
  const [templates, setTemplates] = useState<Starter[] | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/templates/starters')
      .then((r) => r.json())
      .then((d) => {
        if (active) setTemplates(Array.isArray(d?.templates) ? d.templates : []);
      })
      .catch(() => {
        if (active) setTemplates([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function duplicate(slug: string) {
    if (busySlug) return;
    setError(null);
    setBusySlug(slug);
    try {
      const res = await fetch(`/api/templates/duplicate?slug=${encodeURIComponent(slug)}`, { method: 'POST' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error || 'Could not duplicate that template.');
      }
      const { id } = (await res.json()) as { id?: string };
      if (!id) throw new Error('Could not duplicate that template.');
      toEditor(id);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
      setBusySlug(null);
    }
  }

  return (
    <div>
      <BrandLoader open={!!busySlug} message="Duplicating…" />
      <h1 className="text-2xl font-semibold tracking-tight">Start from a template</h1>
      <p className="mt-2 text-zinc-400">Duplicate a polished site and make it yours.</p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {templates === null ? (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading templates">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
              <div className="aspect-[16/10] w-full animate-pulse bg-zinc-800/70" />
              <div className="space-y-2 p-4">
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-800" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-800/70" />
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="mt-8 text-sm text-zinc-500">
          No starter templates available right now. You can start from your industry or a blank site instead.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t.slug}
              onClick={() => duplicate(t.slug)}
              disabled={!!busySlug}
              className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 text-left transition hover:border-sky-500/50 disabled:opacity-60"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-800/60">
                {t.heroUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.heroUrl}
                    alt={t.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-3xl font-bold text-zinc-600">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {busySlug === t.slug && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 text-sm text-white">
                    Duplicating…
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="truncate text-sm font-semibold text-white">{t.name}</div>
                {t.industry && <div className="truncate text-xs text-zinc-400">{t.industry}</div>}
                <span className="mt-2 inline-flex items-center text-xs font-medium text-sky-400">
                  Use this template <ArrowRight className="ml-1 h-3 w-3" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
