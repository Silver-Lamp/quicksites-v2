// components/admin/templates/render-blocks/contact-form.tsx
'use client';

import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import SectionShell from '@/components/ui/section-shell';
import { defaultContactHeading, isPersonTemplate } from '@/lib/sites/personSite';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type ThemeMode = 'light' | 'dark';

const norm = (arr: unknown): string[] =>
  Array.isArray(arr)
    ? Array.from(new Set(arr.map((s) => String(s ?? '').trim()).filter(Boolean)))
    : [];

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '').trim());

const fmtPhone = (raw: string) => {
  const d = String(raw ?? '').replace(/\D/g, '').slice(0, 10);
  return d.replace(/(\d{0,3})(\d{0,3})(\d{0,4})/, (_, a, b, c) =>
    [a && `(${a}`, b && `) ${b}`, c && `-${c}`].filter(Boolean).join('')
  );
};

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

  const allServices = dbServices.length ? dbServices : blockServices;

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

  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const displayPhone = phoneDigits ? fmtPhone(phoneDigits) : '';

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
    industryKey === 'restaurant' || isPersonTemplate((t as any)?.data ?? t);

  // site slug for email subject/logs
  const siteSlug =
    typeof window !== 'undefined'
      ? (() => {
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

  const isValidPhone = (phone: string) =>
    /^\(\d{3}\) \d{3}-\d{4}$/.test(phone);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!hasValidEmail) {
      setSubmitError(
        isEditor
          ? 'No valid contact email is configured. Set it in Template Identity.'
          : 'Sorry — this form isn’t set up to receive messages right now.'
      );
      return;
    }

    const nextErrors: typeof errors = {};
    if (!formData.name) nextErrors.name = 'Name is required.';
    if (!formData.email && !formData.phone)
      nextErrors.contact =
        'Please provide either an email or phone number.';
    if (formData.email && !isValidEmail(formData.email))
      nextErrors.email = 'Email format is invalid.';
    if (formData.phone && !isValidPhone(formData.phone))
      nextErrors.phone = 'Phone number must be in US format.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    const { data, error: insertError } = await supabase
      .from('form_submissions')
      .insert([
        {
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          service: formData.service || null,
          site_slug: siteSlug,
        },
      ])
      .select()
      .single();

    if (insertError || !data) {
      console.error('Insert error:', insertError);
      setSubmitError('There was a problem submitting the form. Please try again.');
      setSubmitting(false);
      return;
    }

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

    await supabase
      .from('form_submissions')
      .update({
        email_status: emailStatus,
        email_response_id: emailResponseId,
        email_error: emailError,
      })
      .eq('id', data.id);

    setSubmitting(false);
    setSubmitted(true);
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
                Or call us at{' '}
                <a href={`tel:${phoneDigits}`} className="underline">
                  {displayPhone}
                </a>
              </div>
            )}
            {hasValidEmail && (
              <div className="text-muted-foreground">We’ll reply from {effectiveEmail}</div>
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
              Thank you! Your submission has been received.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-foreground">
              <div>
                <label className="block font-semibold mb-1">Name:</label>
                <input
                  type="text"
                  name="name"
                  className={inputClass(!!errors.name)}
                  value={formData.name}
                  onChange={handleChange}
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1">Email:</label>
                <input
                  type="email"
                  name="email"
                  className={inputClass(!!errors.email)}
                  value={formData.email}
                  onChange={handleChange}
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1">Phone Number:</label>
                <input
                  type="tel"
                  name="phone"
                  inputMode="numeric"
                  placeholder="(555) 123-4567"
                  maxLength={14}
                  className={inputClass(!!errors.phone || !!errors.contact)}
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: fmtPhone(e.target.value) })
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
                <label className="block font-semibold mb-1">
                  I&apos;m Interested In:
                </label>
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
                    name="service"
                    className={inputClass()}
                    value={formData.service}
                    onChange={handleChange}
                    /* ⚠️ NEVER required. A contact form that cannot be submitted is worse than one
                       missing a field, and this one is the only way to reach the business. */
                  >
                    <option value="">Select a service</option>
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
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          )}
        </div>
      </SectionShell>
    </section>
  );
}
