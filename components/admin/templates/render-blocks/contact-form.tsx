// components/admin/templates/render-blocks/contact-form.tsx
'use client';

import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import SectionShell from '@/components/ui/section-shell';
import ThemeScope from '@/components/ui/theme-scope';
import { useState } from 'react';
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
  const isLight = colorMode === 'light';
  const anchorId = (block?.content as any)?.anchor_id || 'contact';

  // Presentational bits from block
  const {
    title: titleRaw = 'Contact Us',
    services: includedSubset = [],
    notification_email: legacyBlockEmail,
  } = (block?.content as any) || {};

  // ---- Resolve identity from template/site (with fallbacks to block) -------
  const dbServices = norm(
    deepGet(t, 'services') ??
      deepGet(t, 'data.meta.services') ??
      deepGet(t, 'data.services')
  );

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

  const title =
    titleRaw || (businessName ? `Contact ${businessName}` : 'Contact Us');

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
  };

  const isValidPhone = (phone: string) =>
    /^\(\d{3}\) \d{3}-\d{4}$/.test(phone);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasValidEmail) {
      alert(
        'No valid contact email is configured. Please update it in Template Identity.'
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
      alert(
        'There was a problem submitting the form. Please try again later.'
      );
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
    `w-full rounded px-3 py-2 transition-colors bg-white text-black dark:bg-neutral-800 dark:text-white ${
      error ? 'border border-red-500' : 'border border-zinc-300 dark:border-zinc-700'
    }`;

  return (
    <ThemeScope
      mode={colorMode}
      className={`${isLight ? 'bg-white' : 'dark:bg-neutral-950'} rounded-lg p-4`}
    >
      <section id={anchorId} data-contact-anchor className="contents">
        <SectionShell compact className="rounded-lg p-0">
          <h2
            className={`text-center text-2xl font-bold mb-2 p-4 rounded-md ${
              isLight ? 'text-blue-900 bg-white' : 'text-white dark:bg-neutral-950'
            }`}
          >
            {title}
          </h2>

          {/* Identity surface: show what we’ll use */}
          <div className="text-center text-sm mb-4 px-4">
            {businessName && (
              <div className={isLight ? 'text-gray-700' : 'text-gray-300'}>
                {businessName}
              </div>
            )}
            {displayPhone && (
              <div className={isLight ? 'text-gray-700' : 'text-gray-300'}>
                Or call us at{' '}
                <a href={`tel:${phoneDigits}`} className="underline">
                  {displayPhone}
                </a>
              </div>
            )}
            {hasValidEmail && (
              <div className={isLight ? 'text-gray-600' : 'text-gray-400'}>
                We’ll reply from {effectiveEmail}
              </div>
            )}
          </div>

          {showEmailNudge && (
            <div className="mx-4 mb-4 rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200">
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
            <p
              className={
                isLight ? 'text-green-600 text-center' : 'text-green-500 text-center'
              }
            >
              Thank you! Your submission has been received.
            </p>
          ) : (
            <form
              onSubmit={handleSubmit}
              className={`space-y-4 p-4 ${isLight ? 'text-black' : 'text-white'}`}
            >
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

              <div>
                <label className="block font-semibold mb-1">
                  I&apos;m Interested In:
                </label>
                {services.length === 0 ? (
                  <div className="text-red-500 text-sm italic bg-red-900/10 border border-red-500/30 rounded px-3 py-2">
                    No services configured. This form prefers{' '}
                    <code>template.services</code> and falls back to the block’s
                    own items.
                  </div>
                ) : (
                  <select
                    name="service"
                    className={inputClass()}
                    value={formData.service}
                    onChange={handleChange}
                    required
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

              <div className="flex justify-center gap-4 pt-2">
                <button
                  type="submit"
                  disabled={submitting || services.length === 0 || !hasValidEmail}
                  className="bg-blue-900 hover:bg-blue-800 text-white px-6 py-2 rounded transition disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          )}
        </SectionShell>
      </section>
    </ThemeScope>
  );
}
