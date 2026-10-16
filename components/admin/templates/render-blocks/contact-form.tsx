// components/admin/templates/render-blocks/contact-form.tsx
'use client';

import type { Block } from '@/types/blocks';
import { chromeStrings, siteLocale } from '@/lib/sites/siteLocale';
import { formatUsPhone, telHref } from '@/lib/phone/formatUs';
import { formatPhoneInput, phoneMaxLength, phonePlaceholder, phoneRegionForSite, phoneValidationError } from '@/lib/phone/region';
import { abEvent } from '@/lib/ab/client';
import type { Template } from '@/types/template';
import SectionShell from '@/components/ui/section-shell';
import { defaultContactHeading, isPersonTemplate } from '@/lib/sites/personSite';
import { contactInterestsFor } from '@/lib/industries/contactInterests';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type ThemeMode = 'light' | 'dark';

const norm = (arr: unknown): string[] =>
  Array.isArray(arr)
    ? Array.from(new Set(arr.map((s) => String(s ?? '').trim()).filter(Boolean)))
    : [];

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '').trim());

// ⚠️ This used to truncate with `.slice(0, 10)`, turning the E.164 `+12536552016` into
// `1253655201` and rendering "(125) 365-5201" — a plausible, dialable, WRONG number, live on
// southhilltowing.com. Shared formatter now; it strips a country code and never invents digits.
const fmtPhone = (raw: string) => formatUsPhone(raw);

// ---- NEW: robust value resolvers -------------------------------------------

const deepGet = (obj: any, path: string) =>
  path.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);

const firstNonEmpty = (...vals: any[]) =>
  vals.find((v) => v !== undefined && v !== null && String(v).trim() !== '');

// ----------------------------------------------------------------------------

export default function ContactFormRender({
  block,
  template,
  colorMode = 'light',
}: {
  block: Block;
  template: Template | any;
  colorMode?: ThemeMode;
}) {
  const t: any = template ?? {};
  const anchorId = (block?.content as any)?.anchor_id || 'contact';

  // Presentational bits from block
  const {
    title: titleRaw,
    services: includedSubset = [],
    notification_email: legacyBlockEmail,
  } = (block?.content as any) || {};

  // ---- Resolve identity from template/site (with fallbacks to block) -------
  // Pick the first NON-EMPTY source. `??` alone was wrong: in the preview/site
  // renderer `t.services` is an empty array (unset services_jsonb column), and
  // `[] ?? x` returns `[]` — short-circuiting before the populated
  // data.meta.services / data.services (where autogenerate writes them).
  const dbServices =
    [
      deepGet(t, 'services'),
      deepGet(t, 'data.meta.services'),
      deepGet(t, 'data.services'),
    ]
      .map(norm)
      .find((arr) => arr.length > 0) ?? [];

  const blockServices = norm(
    (block as any)?.content?.services ?? (block as any)?.content?.items
  );

  // ⚠️ WHICH QUESTION THE DROPDOWN ASKS IS DECIDED PER INDUSTRY (lib/industries/contactInterests.ts).
  // For an `options` industry (a band) the template-level services are ignored — they were only
  // ever the catalog's generic fallback — and the block's own list is the owner's override.
  const interestIndustry = String((t as any)?.data?.meta?.industry ?? (t as any)?.industry ?? '').toLowerCase();
  const interests = contactInterestsFor(interestIndustry);
  const allServices =
    interests.mode === 'options'
      ? blockServices.length
        ? blockServices
        : interests.options
      : dbServices.length
        ? dbServices
        : blockServices;
  const pickerLabel = interests.mode === 'hide' ? "I'm Interested In:" : interests.label;
  // When the OWNER typed the block's own options, the empty state says "Select one" — "Select a
  // service" over "I want to order for myself / I run a store" is the trade placeholder leaking.
  const usingBlockList = interests.mode !== 'options' && dbServices.length === 0 && blockServices.length > 0;
  const pickerPlaceholder = usingBlockList ? 'Select one' : interests.mode === 'hide' ? 'Select a service' : interests.placeholder;

  // Case-insensitive subset filter if author chose a subset in block content
  const includesSet = new Set(norm(includedSubset).map((s) => s.toLowerCase()));
  const services =
    includesSet.size > 0
      ? allServices.filter((s) => includesSet.has(String(s).toLowerCase()))
      : allServices;

  const dbEmailRaw = firstNonEmpty(
    t.contact_email,
    t.contactEmail,
    deepGet(t, 'meta.contact_email'),
    deepGet(t, 'meta.contact.email'),
    deepGet(t, 'data.meta.contact_email'),
    deepGet(t, 'data.meta.contact.email'), // ← sites.row path
    deepGet(t, 'data.contact.email'),
    deepGet(t, 'site.data.meta.contact.email')
  );

  const dbEmail = String(dbEmailRaw ?? '').trim();
  const effectiveEmail = dbEmail || String(legacyBlockEmail || '').trim();
  const hasValidEmail = isValidEmail(effectiveEmail);
  const showEmailNudge = !isValidEmail(dbEmail); // nudge if site-level email is missing

  // The "configure contact_email / services" hints open the editor's Template
  // Identity panel via a client event — meaningless in the shareable preview and
  // on published sites. Only surface them inside the editor (/admin/templates/*).
  const [isEditor, setIsEditor] = useState(false);
  useEffect(() => {
    try {
      setIsEditor(window.location.pathname.startsWith('/admin/templates'));
    } catch {}
  }, []);

  const businessName = String(
    firstNonEmpty(
      t.business_name,
      t.businessName,
      deepGet(t, 'meta.business_name'),
      deepGet(t, 'data.meta.business'),
      deepGet(t, 'data.meta.business_name'),
      deepGet(t, 'site.data.meta.business')
    ) ?? ''
  ).trim();

  const phoneRaw = String(
    firstNonEmpty(
      t.phone,
      t.contact_phone,
      t.contactPhone,
      deepGet(t, 'meta.contact_phone'),
      deepGet(t, 'data.meta.contact_phone'),
      deepGet(t, 'data.meta.contact.phone'),
      deepGet(t, 'data.contact.phone'),
      deepGet(t, 'site.data.meta.contact.phone')
    ) ?? ''
  );

  // ⚠️ Format the RAW value, not its digits. `formatUsPhone` returns its input unchanged when it
  // is not a US number, so passing `phoneDigits` turned `+39 0577 000000` into "390577000000"
  // on the Italian demo — true digits, unreadable, and the footer beside it showed the real thing.
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const displayPhone = phoneDigits ? fmtPhone(phoneRaw.trim()) : '';

  // ⚠️ WHICH PHONE FORMAT THE VISITOR IS ASKED FOR IS DECIDED BY THE SITE (lib/phone/region.ts).
  // This form used to format every keystroke into "(555) 123-4567" and refuse anything else, so an
  // Italian restaurant's guests could not leave a number at all.
  const phoneRegion = phoneRegionForSite(t);

  // OUR words on their page (labels, button, errors) follow the site's language — HJ's re-run
  // (2026-10-16) found an Italian trattoria's form saying "Name: / Email: / Phone Number: / Submit".
  const cs = chromeStrings(siteLocale((t as any)?.data ? t : { data: t }));

  // ⚠️ Person sites get "Get in Touch". A one-person portfolio headed "Contact Us" is wrong about
  // who is on the page, not merely unfashionable. See lib/sites/personSite.ts.
  const title = titleRaw || defaultContactHeading((t as any)?.data ?? t, businessName);

  // ⚠️ A "which service?" question only makes sense where the business sells services. On a
  // restaurant the unit is a DISH, and the list we would offer is Places categories anyway.
  // Person sites are the same shape — nobody picks a service from a résumé.
  const industryKey = String(
    (t as any)?.data?.meta?.industry ?? (t as any)?.industry ?? '',
  ).toLowerCase();
  const hideServicePicker =
    interests.mode === 'hide' || industryKey === 'restaurant' || isPersonTemplate((t as any)?.data ?? t);

  // site slug for email subject/logs
  // ⚠️ The slug names the SITE, and the email route derives the recipient from it. On the
  // platform path (`www.quicksites.ai/sites/bhard`) the host-only rule returned "www" — the
  // first label of the host — so the row was filed under a site that does not exist and the
  // notify email went nowhere (live probe, 2026-10-16). Path first, then host.
  const siteSlug =
    typeof window !== 'undefined'
      ? (() => {
          const fromPath = /^\/sites\/([^/?#]+)/.exec(window.location.pathname)?.[1];
          if (fromPath) return decodeURIComponent(fromPath);
          const host = window.location.hostname.toLowerCase();
          if (host.endsWith('.quicksites.ai')) return host.split('.')[0];
          const parts = host.replace(/^www\./, '').split('.');
          return parts.length >= 2 ? parts[0] : host;
        })()
      : 'unknown';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    name?: string;
    contact?: string;
    email?: string;
    phone?: string;
  }>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({});
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!hasValidEmail) {
      setSubmitError(
        isEditor
          ? 'No valid contact email is configured. Set it in Template Identity.'
          : cs.formNotSetUp
      );
      return;
    }

    const nextErrors: typeof errors = {};
    if (!formData.name) nextErrors.name = cs.nameRequired;
    if (!formData.email && !formData.phone)
      nextErrors.contact = cs.contactRequired;
    if (formData.email && !isValidEmail(formData.email))
      nextErrors.email = cs.emailInvalid;
    const phoneError = phoneValidationError(formData.phone, phoneRegion);
    if (phoneError) nextErrors.phone = phoneError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    // ⚠️ INSERT WITHOUT A RETURNING SELECT. `form_submissions` lets anon INSERT and UPDATE but
    // only admins SELECT (migration 20260627 — the PII leak it closed was anon READ). PostgREST
    // runs `.select()` after an insert as a read of the new row, which that policy refuses, and
    // reports it as "new row violates row-level security policy" — so from 2026-06-27 to
    // 2026-10-16 EVERY tenant contact form failed with "There was a problem submitting the form"
    // while the table's last row stayed dated April. Found by replaying this exact call with the
    // anon key while answering an unrelated question about where B Hard's leads should go.
    // The id is minted here so the email route and the status update can still name the row.
    const submissionId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const { error: insertError } = await supabase.from('form_submissions').insert([
      {
        id: submissionId,
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        service: formData.service || null,
        site_slug: siteSlug,
      },
    ]);

    if (insertError) {
      console.error('Insert error:', insertError);
      setSubmitError(cs.submitFailed);
      setSubmitting(false);
      return;
    }
    const data = { id: submissionId };

    let emailStatus = 'pending';
    let emailResponseId: string | null = null;
    let emailError: string | null = null;

    try {
      const res = await fetch('/api/send-contact-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [effectiveEmail], // use site/template email; fallback to block-level if needed
          subject: `New Contact Form Submission from ${siteSlug}`,
          message: `
New contact form submission from ${siteSlug}:

Business: ${businessName || 'N/A'}
Phone: ${displayPhone || 'N/A'}

Name: ${formData.name}
Email: ${formData.email || 'N/A'}
Phone: ${formData.phone || 'N/A'}
Service: ${formData.service || 'N/A'}
          `.trim(),
          user_email: formData.email || null,
          site_slug: siteSlug,
          form_submission_id: data.id,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && (json as any).success) {
        emailStatus = 'sent';
        emailResponseId = (json as any).id || null;
      } else {
        emailStatus = 'error';
        emailError = (json as any).error || `HTTP ${res.status}`;
      }
    } catch (err: any) {
      console.error('Email error:', err);
      emailStatus = 'error';
      emailError = err?.message || 'Unexpected exception';
    }

    // The email's fate is recorded by /api/send-contact-email with the service role. An anon
    // UPDATE here returned 204 and changed nothing (the admin-only SELECT policy governs the
    // rows an UPDATE's WHERE reads) — measured 2026-10-16.
    void emailStatus; void emailResponseId; void emailError;

    setSubmitting(false);
    setSubmitted(true);
    abEvent('form_submitted'); // per-site A/B conversion (no-op without an active test)
    setFormData({ name: '', email: '', phone: '', service: '' });
  };

  const inputClass = (error?: boolean) =>
    `w-full rounded px-3 py-2 transition-colors bg-background text-foreground border ${
      error ? 'border-red-500' : 'border-input'
    }`;

  return (
    <section id={anchorId} data-contact-anchor>
      <SectionShell compact className="bg-transparent">
        <div className="mx-auto w-full max-w-xl bg-card text-card-foreground border border-border rounded-lg p-6 shadow-sm">
          <h2 className="text-center text-2xl font-bold mb-2 text-foreground">
            {title}
          </h2>

          {/* Identity surface: show what we’ll use */}
          <div className="text-center text-sm mb-4">
            {businessName && <div className="text-muted-foreground">{businessName}</div>}
            {displayPhone && (
              <div className="text-muted-foreground">
                {cs.orCallUs}{' '}
                <a href={telHref(phoneRaw)} className="underline">
                  {displayPhone}
                </a>
              </div>
            )}
            {hasValidEmail && (
              <div className="text-muted-foreground">{cs.replyFrom} {effectiveEmail}</div>
            )}
          </div>

          {/* ⚠️ This strip was `text-yellow-200` on `bg-yellow-500/10` — yellow on yellow. Legible
              on the dark sites it was written against, nearly invisible on a light one, which is
              where it was reported. The tint carries the "warning" meaning; the text now uses a
              theme token so it follows the site's own scope. `dark:` is not an option here — the
              app chrome pins `.dark`, so the dark variant always wins (components/ui/__tests__). */}
          {showEmailNudge && isEditor && (
            <div className="mx-4 mb-4 rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-foreground">
              No valid <code>contact_email</code> is configured on the site.{' '}
              <button
                onClick={() => {
                  try {
                    window.dispatchEvent(
                      new CustomEvent('qs:panel:open', {
                        detail: { id: 'template-identity', focus: 'contact_email' },
                      })
                    );
                  } catch {}
                  if (typeof window !== 'undefined')
                    window.location.hash = '#template-identity';
                }}
                className="underline"
              >
                Set it in Template Identity
              </button>
              {hasValidEmail && ' (using block-level fallback for now)'}
            </div>
          )}

          {submitted ? (
            <p className="text-green-600 text-center">
              {cs.thanks}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-foreground">
              <div>
                <label htmlFor="contact-name" className="block font-semibold mb-1">{cs.name}</label>
                <input
                  id="contact-name"
                  type="text"
                  name="name"
                  autoComplete="name"
                  className={inputClass(!!errors.name)}
                  value={formData.name}
                  onChange={handleChange}
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="contact-email" className="block font-semibold mb-1">{cs.email}</label>
                <input
                  id="contact-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  className={inputClass(!!errors.email)}
                  value={formData.email}
                  onChange={handleChange}
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="contact-phone" className="block font-semibold mb-1">{cs.phoneNumber}</label>
                <input
                  id="contact-phone"
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder={phonePlaceholder(phoneRegion)}
                  maxLength={phoneMaxLength(phoneRegion)}
                  className={inputClass(!!errors.phone || !!errors.contact)}
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: formatPhoneInput(e.target.value, phoneRegion, fmtPhone) })
                  }
                />
                {(errors.phone || errors.contact) && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.phone || errors.contact}
                  </p>
                )}
              </div>

              {/* No services and not in the editor? Render nothing at all — label included.
                  The label used to sit outside this check, so a site with no service list showed
                  a heading "I'm Interested In:" above empty space.

                  ⚠️ AND ON A RESTAURANT IT WAS A REQUIRED FIELD FULL OF NONSENSE. The listing
                  importer fills `services` from Google Places CATEGORY labels, so Torero's asked
                  a hungry person what they were "interested in" and made them choose between
                  "Mexican restaurant", "Burrito restaurant" and "Chicken wings restaurant" before
                  the form would send. All 127 listing-import drafts are in that state.
                  A category is not a service — nobody is interested in "Restaurant" — and a
                  required question with no true answer does not just clutter the form, it BLOCKS
                  the only way to contact the business. See `hideServicePicker`. */}
              <div className={(services.length === 0 || hideServicePicker) && !isEditor ? 'hidden' : undefined}>
                <label htmlFor="contact-service" className="block font-semibold mb-1">{pickerLabel}</label>
                {services.length === 0 ? (
                  isEditor ? (
                    <div className="text-red-500 text-sm italic bg-red-900/10 border border-red-500/30 rounded px-3 py-2">
                      No services configured. This form prefers{' '}
                      <code>template.services</code> and falls back to the block’s
                      own items.
                    </div>
                  ) : null
                ) : (
                  <select
                    id="contact-service"
                    name="service"
                    className={inputClass()}
                    value={formData.service}
                    onChange={handleChange}
                    /* ⚠️ NEVER required. A contact form that cannot be submitted is worse than one
                       missing a field, and this one is the only way to reach the business. */
                  >
                    <option value="">{pickerPlaceholder}</option>
                    {services.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500"
                >
                  {submitError}
                </div>
              )}

              <div className="flex justify-center gap-4 pt-2">
                <button
                  type="submit"
                  disabled={submitting || services.length === 0 || !hasValidEmail}
                  className="bg-primary text-primary-foreground hover:opacity-90 px-6 py-2 rounded transition disabled:opacity-50"
                >
                  {submitting ? cs.submitting : cs.submit}
                </button>
              </div>
            </form>
          )}
        </div>
      </SectionShell>
    </section>
  );
}
