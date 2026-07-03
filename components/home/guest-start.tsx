// components/home/guest-start.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ensureGuestSession } from '@/lib/auth/guestSession';
import { INDUSTRIES, type IndustryKey } from '@/lib/industries';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';

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

/**
 * Homepage quick-start: business name + industry → mint an anonymous Supabase
 * session → create a draft template owned by that session → open the editor.
 *
 * Gated by the guest-build feature flag at the call site (app/page.tsx).
 */
export default function GuestStart() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

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

      // 3) drop into the editor (publish stays gated until signup)
      router.push(`/admin/templates/${json.id}`);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      // Sizes are ~2x the previous card. Accent-driven colors read from CSS vars
      // (--qs-accent / --qs-accent-2 / --qs-accent-fg) so the homepage color lab
      // can recolor this live; the fallbacks are the original sky palette.
      className="mt-12 w-full max-w-3xl scroll-mt-24 rounded-[2rem] border p-12 shadow-2xl ring-1 ring-inset ring-white/5 backdrop-blur-sm sm:p-14"
      style={{
        borderColor: 'color-mix(in srgb, var(--qs-accent, #0ea5e9) 30%, transparent)',
        background:
          'linear-gradient(to bottom, color-mix(in srgb, var(--qs-accent, #0ea5e9) 16%, rgba(9,12,20,0.9)), rgba(24,24,27,0.72))',
        boxShadow: '0 30px 80px -20px color-mix(in srgb, var(--qs-accent, #0ea5e9) 35%, transparent)',
      }}
    >
      <div className="flex flex-col gap-6 sm:flex-row">
        <input
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Your business name"
          aria-label="Business name"
          disabled={loading}
          className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-900/70 px-8 py-6 text-2xl text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none"
        />
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          aria-label="Industry"
          disabled={loading}
          className="rounded-2xl border border-zinc-700 bg-zinc-900/70 px-8 py-6 text-2xl text-white focus:border-white/40 focus:outline-none sm:w-80"
        >
          <option value="">Industry (optional)</option>
          {INDUSTRIES.map((i, idx) => (
            <option key={`${i.key}-${idx}`} value={i.key}>
              {i.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl px-12 py-6 text-2xl font-semibold shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        style={{
          backgroundColor: 'var(--qs-accent, #0ea5e9)',
          color: 'var(--qs-accent-fg, #09090b)',
        }}
      >
        {loading ? 'Building your site…' : '✨ Build my site — free, no signup'}
      </button>

      <p className="mt-6 text-base text-zinc-400">
        No credit card. Sign up only when you’re ready to go live.
      </p>

      {error && (
        <p className="mt-4 text-lg text-red-400" role="alert">
          {error}
        </p>
      )}
    </motion.form>
  );
}
