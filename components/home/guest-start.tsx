// components/home/guest-start.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ensureGuestSession } from '@/lib/auth/guestSession';
import { INDUSTRIES } from '@/lib/industries';

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

      // 2) create a draft site/template owned by this session
      const industryLabel =
        INDUSTRIES.find((i) => i.key === industry)?.label ?? undefined;

      const res = await fetch('/api/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_name: name,
          slug: `${slugify(name) || 'site'}-${randSuffix()}`,
          is_site: true,
          color_mode: 'light',
          data: {
            meta: {
              business_name: name,
              ...(industry ? { industry } : {}),
              ...(industryLabel ? { industry_label: industryLabel } : {}),
            },
          },
        }),
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
      className="mt-8 w-full max-w-xl"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Your business name"
          aria-label="Business name"
          disabled={loading}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 py-3 text-base text-white placeholder:text-zinc-500 focus:border-sky-500 focus:outline-none"
        />
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          aria-label="Industry"
          disabled={loading}
          className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 py-3 text-base text-white focus:border-sky-500 focus:outline-none sm:w-52"
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
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-sky-500 px-6 py-3 text-base font-semibold text-zinc-950 shadow-lg transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {loading ? 'Building your site…' : '✨ Build my site — free, no signup'}
      </button>

      <p className="mt-3 text-xs text-zinc-500">
        No credit card. Sign up only when you’re ready to go live.
      </p>

      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </motion.form>
  );
}
