// components/admin/templates/render-blocks/listing-alert.tsx
'use client';

// "New-listing alerts" — the buyer-side lead capture for real-estate agent sites (companion to
// home_valuation's seller side). A buyer says what they're looking for (area, price, beds) and
// the lead goes to the agent via the hardened submission rail (recipient derived server-side
// from the site slug). Honest: no automated MLS feed here — the agent gets a qualified buyer
// lead and follows up with matches. If an IDX/listing feed is wired later, this becomes a real
// saved search.

import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import SectionShell from '@/components/ui/section-shell';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type ThemeMode = 'light' | 'dark';

const deepGet = (obj: any, path: string) =>
  path.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
const firstNonEmpty = (...vals: any[]) =>
  vals.find((v) => v !== undefined && v !== null && String(v).trim() !== '');
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '').trim());

export default function ListingAlertRender({
  block,
  template,
  colorMode = 'light',
}: {
  block: Block;
  template?: Template | any;
  colorMode?: ThemeMode;
}) {
  const t: any = template ?? {};
  const c: any = (block?.content as any) ?? (block as any)?.props ?? {};

  const title = String(c.title || 'Get new listings first');
  const subtitle = String(
    c.subtitle ||
      'Tell me what you’re looking for and I’ll send you matching homes the moment they hit the market.'
  );
  const ctaLabel = String(c.cta_label || 'Notify me of new listings');
  const disclaimer = String(
    c.disclaimer || 'No spam, no obligation — just the homes that fit. Unsubscribe anytime.'
  );

  const businessName = String(
    firstNonEmpty(
      t.business_name,
      t.businessName,
      deepGet(t, 'data.meta.business'),
      deepGet(t, 'data.meta.business_name')
    ) ?? 'your local agent'
  ).trim();

  const effectiveEmail = String(
    firstNonEmpty(
      t.contact_email,
      deepGet(t, 'data.meta.contact.email'),
      deepGet(t, 'data.meta.contact_email')
    ) ?? ''
  ).trim();

  const siteSlug =
    typeof window !== 'undefined'
      ? (() => {
          const host = window.location.hostname.toLowerCase();
          if (host.endsWith('.quicksites.ai')) return host.split('.')[0];
          const parts = host.replace(/^www\./, '').split('.');
          return parts.length >= 2 ? parts[0] : host;
        })()
      : 'unknown';

  const dark = colorMode === 'dark';
  const [form, setForm] = useState({
    area: '',
    price_max: '',
    beds: '',
    name: '',
    email: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.area.trim()) return setError('Where are you looking? Enter an area or city.');
    if (!form.name.trim()) return setError('Please enter your name.');
    if (!isValidEmail(form.email)) return setError('Please enter a valid email.');
    setSubmitting(true);
    try {
      const { data, error: insErr } = await supabase
        .from('form_submissions')
        .insert([
          {
            name: form.name,
            email: form.email || null,
            phone: form.phone || null,
            service: 'New-listing alert',
            site_slug: siteSlug,
          },
        ])
        .select()
        .single();
      if (insErr || !data) throw new Error('submit_failed');

      const criteria = [
        `Area: ${form.area}`,
        form.price_max && `Max price: ${form.price_max}`,
        form.beds && `Beds: ${form.beds}+`,
      ]
        .filter(Boolean)
        .join('\n');
      await fetch('/api/send-contact-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: effectiveEmail ? [effectiveEmail] : undefined,
          subject: `🔔 New-listing alert signup from ${siteSlug}`,
          message: `New buyer wants listing alerts from ${siteSlug}:\n\n${criteria}\n\nName: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone || 'N/A'}`,
          user_email: form.email || null,
          site_slug: siteSlug,
          form_submission_id: data.id,
        }),
      }).catch(() => {});

      setDone(true);
    } catch {
      setError('There was a problem signing you up. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const field = `w-full rounded-lg border px-3 py-2 text-sm ${
    dark
      ? 'border-white/15 bg-white/5 text-white placeholder-white/40'
      : 'border-zinc-300 bg-white text-zinc-900'
  }`;

  return (
    <SectionShell>
      <div id="listing-alerts" className="mx-auto max-w-xl scroll-mt-20 text-center">
        <h2 className={`text-2xl font-bold md:text-3xl ${dark ? 'text-white' : 'text-zinc-900'}`}>
          {title}
        </h2>
        <p className={`mt-2 text-sm ${dark ? 'text-white/70' : 'text-zinc-600'}`}>{subtitle}</p>

        {done ? (
          <div
            className={`mt-6 rounded-xl border p-6 ${
              dark
                ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
                : 'border-sky-300 bg-sky-50 text-sky-800'
            }`}
          >
            <p className="text-base font-semibold">
              You&rsquo;re on the list, {form.name.split(' ')[0] || 'there'}! 🔔
            </p>
            <p className="mt-1 text-sm">
              {businessName} will send you new {form.area} listings as they come up.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3 text-left">
            <input
              className={field}
              placeholder="Area or city you're searching"
              value={form.area}
              onChange={set('area')}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className={field}
                placeholder="Max price (optional)"
                inputMode="numeric"
                value={form.price_max}
                onChange={set('price_max')}
              />
              <input
                className={field}
                placeholder="Min beds (optional)"
                inputMode="numeric"
                value={form.beds}
                onChange={set('beds')}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className={field}
                placeholder="Your name"
                value={form.name}
                onChange={set('name')}
                autoComplete="name"
              />
              <input
                className={field}
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
              />
            </div>
            <input
              className={field}
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={set('phone')}
              autoComplete="tel"
            />

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
            >
              {submitting ? 'Signing you up…' : ctaLabel}
            </button>
            <p className={`text-center text-xs ${dark ? 'text-white/40' : 'text-zinc-500'}`}>
              {disclaimer}
            </p>
          </form>
        )}
      </div>
    </SectionShell>
  );
}
