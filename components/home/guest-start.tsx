// components/home/guest-start.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ensureGuestSession } from '@/lib/auth/guestSession';
import { INDUSTRIES, type IndustryKey } from '@/lib/industries';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import BrandLoader from '@/components/brand/BrandLoader';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// short, URL-safe random suffix to avoid slug collisions on the shared
// templates table (creation does not check uniqueness)
function randSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

type Mode = 'fresh' | 'convert' | 'domain';

// Staged status copy for the convert path (~10-20s single round-trip).
const CONVERT_STAGES = [
  'Reading your current site…',
  'Understanding your business…',
  'Writing fresh copy…',
  'Assembling your new site…',
];

/**
 * Homepage quick-start with two on-ramps, both minting an anonymous Supabase
 * session and dropping the visitor into the editor (publish stays gated until
 * signup, where the draft auto-claims via the same uid):
 *   - "Start fresh": business name + industry → industry-scaffold draft.
 *   - "I already have a site": paste a URL → AI rebuild draft (POST /api/rebuild).
 *
 * Gated by the guest-build feature flag at the call site (components/home/home-client.tsx).
 */
export default function GuestStart() {
  const [mode, setMode] = useState<Mode>('fresh');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState<string>('');
  const [url, setUrl] = useState('');
  const [parkedDomain, setParkedDomain] = useState('');
  const [parkedRef, setParkedRef] = useState(''); // optional FB/public page to build FROM
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, []);

  const switchMode = (m: Mode) => {
    if (loading) return;
    setMode(m);
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (mode === 'convert') return convert();

    // Amy's case: "I'm paying for a domain but the site is parked." The dedicated
    // /bring-your-domain flow handles it (DNS records for site AND email, starter
    // build) — hand the domain over and let it auto-check on arrival.
    if (mode === 'domain') {
      const d = parkedDomain.trim();
      if (!d) {
        setError('Enter the domain you already own.');
        return;
      }
      // The Amy combo: parked domain + a Facebook page. Carry the page along so the
      // BYO flow builds the first draft FROM it (rebuild-first) instead of a scaffold.
      const ref = parkedRef.trim();
      const qs = `domain=${encodeURIComponent(d)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`;
      window.location.assign(`/bring-your-domain?${qs}`);
      return;
    }

    const name = businessName.trim();
    if (!name) {
      setError('Tell us your business name to get started.');
      return;
    }

    setLoading(true);
    try {
      // 1) ensure we have a session (mint an anonymous one if needed)
      const sess = await ensureGuestSession();
      if (!sess.user) {
        setError(
          sess.error ||
            'Could not start a free session. You can sign in to build instead.',
        );
        setLoading(false);
        return;
      }

      // 2) create a draft site/template owned by this session, seeded with a real
      //    industry starter (hero / services / faq / contact + services + theme) —
      //    the SAME scaffold the /admin/templates/new industry path uses. Without
      //    this the template is created with only meta (no pages/blocks) and the
      //    editor falls back to empty placeholder blocks (one of them typeless →
      //    "Invalid block: missing or undefined type"). Industry is optional in the
      //    guest form; fall back to 'other' (buildIndustryStarter handles it).
      const industryKey = (industry || 'other') as IndustryKey;
      const initial: any = buildIndustryStarter({ businessName: name, industryKey });
      // Collision-safe slug (the templates table doesn't enforce uniqueness).
      initial.slug = `${slugify(name) || 'site'}-${randSuffix()}`;
      // One-shot flag: the hero editor auto-runs "Suggest All" + "Generate" once
      // when it first opens for this site, so the guest gets AI copy + a hero image
      // without manually clicking. Cleared after it runs.
      initial.data = initial.data || {};
      initial.data.meta = { ...(initial.data.meta || {}), autogen_pending: true };

      const res = await fetch('/api/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initial),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.id) {
        setError(json?.error || 'Could not create your site. Please try again.');
        setLoading(false);
        return;
      }

      // 3) drop into the editor (publish stays gated until signup).
      // Hard-navigate (not router.push): a soft nav briefly re-exposes the homepage
      // while the async /admin layout auth resolves, before the editor's loading.tsx
      // (the same BrandLoader) shows. A full navigation keeps THIS loader up until the
      // editor paints, so there's no homepage flash between the two loaders.
      window.location.assign(`/admin/templates/${json.id}`);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // Convert an existing site: mint a guest session, then POST the URL to the same
  // AI-rebuild backend the onboarding chooser + /rebuild page use.
  const convert = async () => {
    const target = normalizeUrl(url);
    if (!target) {
      setError('Paste the address of the site you want to convert.');
      return;
    }

    setLoading(true);
    setStage(0);
    stageTimer.current = setInterval(() => {
      setStage((s) => (s < CONVERT_STAGES.length - 1 ? s + 1 : s));
    }, 3500);

    try {
      const sess = await ensureGuestSession();
      if (!sess.user) {
        setError(sess.error || 'Could not start a free session. Sign in to convert instead.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json?.id) {
        setError(json?.error || 'Could not convert that site. Try another URL.');
        setLoading(false);
        return;
      }
      // Hard-navigate so the loader stays up until the editor paints (no homepage
      // flash during the soft-nav layout auth). See the note in the fresh flow above.
      window.location.assign(`/admin/templates/${json.id}`);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setLoading(false);
    } finally {
      if (stageTimer.current) clearInterval(stageTimer.current);
    }
  };

  const tabClass = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-medium transition sm:text-base ${
      active
        ? 'bg-white/10 text-white ring-1 ring-inset ring-white/20'
        : 'text-zinc-400 hover:text-zinc-200'
    }`;

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      // Sizes are ~2x the previous card. Accent-driven colors read from CSS vars
      // (--qs-accent / --qs-accent-2 / --qs-accent-fg) so the homepage color lab
      // can recolor this live; the fallbacks are the original sky palette.
      className="mt-8 w-full max-w-3xl scroll-mt-24 rounded-3xl border p-5 shadow-2xl ring-1 ring-inset ring-white/5 backdrop-blur-sm sm:mt-12 sm:rounded-[2rem] sm:p-14"
      style={{
        borderColor: 'color-mix(in srgb, var(--qs-accent, #0ea5e9) 30%, transparent)',
        background:
          'linear-gradient(to bottom, color-mix(in srgb, var(--qs-accent, #0ea5e9) 16%, rgba(9,12,20,0.9)), rgba(24,24,27,0.72))',
        boxShadow: '0 30px 80px -20px color-mix(in srgb, var(--qs-accent, #0ea5e9) 35%, transparent)',
      }}
    >
      {/* Mode toggle */}
      <div className="mb-5 inline-flex gap-1 rounded-2xl bg-black/20 p-1 sm:mb-8">
        <button type="button" onClick={() => switchMode('fresh')} className={tabClass(mode === 'fresh')}>
          Start fresh
        </button>
        <button type="button" onClick={() => switchMode('convert')} className={tabClass(mode === 'convert')}>
          I already have a site
        </button>
        <button type="button" onClick={() => switchMode('domain')} className={tabClass(mode === 'domain')}>
          I have a domain
        </button>
      </div>

      {mode === 'fresh' ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Your business name"
            aria-label="Business name"
            disabled={loading}
            className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-900/70 px-5 py-3.5 text-base text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none sm:px-8 sm:py-6 sm:text-2xl"
          />
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            aria-label="Industry"
            disabled={loading}
            className="rounded-2xl border border-zinc-700 bg-zinc-900/70 px-5 py-3.5 text-base text-white focus:border-white/40 focus:outline-none sm:w-80 sm:px-8 sm:py-6 sm:text-2xl"
          >
            <option value="">Industry (optional)</option>
            {INDUSTRIES.map((i, idx) => (
              <option key={`${i.key}-${idx}`} value={i.key}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
      ) : mode === 'convert' ? (
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourbusiness.com or facebook.com/yourpage"
          aria-label="Existing website or public page address"
          disabled={loading}
          className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/70 px-5 py-3.5 text-base text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none sm:px-8 sm:py-6 sm:text-2xl"
        />
      ) : (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            inputMode="url"
            value={parkedDomain}
            onChange={(e) => setParkedDomain(e.target.value)}
            placeholder="yourdomain.com"
            aria-label="Domain you already own"
            disabled={loading}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/70 px-5 py-3.5 text-base text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none sm:px-8 sm:py-6 sm:text-2xl"
          />
          <input
            type="text"
            inputMode="url"
            value={parkedRef}
            onChange={(e) => setParkedRef(e.target.value)}
            placeholder="facebook.com/yourpage — we’ll build from it (optional)"
            aria-label="Facebook or other public page to build from (optional)"
            disabled={loading}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/70 px-5 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none sm:px-8 sm:py-4 sm:text-lg"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-center text-base font-semibold shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-6 sm:px-12 sm:py-6 sm:text-2xl sm:w-auto"
        style={{
          backgroundColor: 'var(--qs-accent, #0ea5e9)',
          color: 'var(--qs-accent-fg, #09090b)',
        }}
      >
        {loading
          ? mode === 'convert'
            ? '✨ Rebuilding your site… (~20s)'
            : '✨ Generating your site… (~25s)'
          : mode === 'convert'
            ? '✨ Convert my site — free, no signup'
            : mode === 'domain'
              ? '✨ Check my domain — free, no signup'
              : '✨ Build my site — free, no signup'}
      </button>

      {loading && mode === 'convert' ? (
        <p className="mt-4 text-sm text-zinc-300 sm:mt-6 sm:text-base" role="status" aria-live="polite">
          {CONVERT_STAGES[stage]}
        </p>
      ) : (
        <p className="mt-4 text-sm text-zinc-400 sm:mt-6 sm:text-base">
          {mode === 'convert'
            ? 'Paste any business site OR public page — Wix, WordPress, Squarespace, even a Facebook page. We rebuild it here — edit everything after.'
            : mode === 'domain'
              ? 'Paying for a domain that still shows “under construction”? Keep your registrar and your email. Add your Facebook page and we’ll build your site FROM it — your photos and voice, on your domain.'
              : 'No credit card. Sign up only when you’re ready to go live.'}
        </p>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-400 sm:text-lg" role="alert">
          {error}
        </p>
      )}

      <BrandLoader
        open={loading}
        message={mode === 'convert' ? 'Rebuilding your site' : 'Building your site'}
      />
    </motion.form>
  );
}
