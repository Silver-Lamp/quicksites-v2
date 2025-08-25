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

export default function ContactFormRender({
  block,
  template,
  colorMode = 'light',
}: {
  block: Block;
  template: Template | any; // tolerate mixed shapes
  colorMode?: ThemeMode;
}) {
  const isLight = colorMode === 'light';
  const anchorId = (block?.content as any)?.anchor_id || 'contact';

  // ------------- host helpers -------------
  const siteSlug =
    typeof window !== 'undefined'
      ? (() => {
          const host = window.location.hostname.toLowerCase();
          if (host.endsWith('.quicksites.ai')) return host.split('.')[0];
          const parts = host.replace(/^www\./, '').split('.');
          return parts.length >= 2 ? parts[0] : host;
        })()
      : 'unknown';

  // ------------- content inputs -------------
  const {
    title = 'Contact Us',
    services: includedSubset = [], // editor-chosen subset (optional)
    notification_email: legacyBlockEmail, // legacy per-block email (fallback only)
  } = ((block?.content as any) ?? {}) as {
    title?: string;
    services?: string[];
    notification_email?: string;
  };

  // Prefer DB list; fallback to legacy items on the block
  const dbServices = norm((template as any)?.services);
  const blockServices = norm((block as any)?.content?.services ?? (block as any)?.content?.items);
  const allServices = dbServices.length ? dbServices : blockServices;

  const renderedServices =
    includedSubset && includedSubset.length
      ? allServices.filter((s) => (includedSubset as string[]).includes(s))
      : allServices;

  // Prefer DB email; fallback to legacy block email so the form still works
  const dbEmail =
    String(
      (template as any)?.contact_email ??
        (template as any)?.contactEmail ??
        ''
    ).trim();
  const effectiveEmail = dbEmail || String(legacyBlockEmail || '').trim();
  const hasValidEmail = isValidEmail(effectiveEmail);
  const showEmailNudge = !isValidEmail(dbEmail); // show banner if DB email missing/invalid

  // ------------- form state -------------
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', service: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; contact?: string; email?: string; phone?: string }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({});
  };

  const isValidPhone = (phone: string) => /^\(\d{3}\) \d{3}-\d{4}$/.test(phone);
  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    return digits.replace(/(\d{0,3})(\d{0,3})(\d{0,4})/, (_, a, b, c) =>
      [a && `(${a}`, b && `) ${b}`, c && `-${c}`].filter(Boolean).join('')
    );
  };

  const noServices = renderedServices.length === 0;

  // Helper to nudge users to configure Identity values
  const openIdentityPanel = () => {
    try {
      window.dispatchEvent(new CustomEvent('qs:panel:open', { detail: { id: 'template-identity', focus: 'contact_email' } }));
    } catch {}
    if (typeof window !== 'undefined') window.location.hash = '#template-identity';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasValidEmail) {
      alert('No valid contact email is configured. Please update it in Template Identity.');
      return;
    }

    const nextErrors: typeof errors = {};
    if (!formData.name) nextErrors.name = 'Name is required.';
    if (!formData.email && !formData.phone) nextErrors.contact = 'Please provide either an email or phone number.';
    if (formData.email && !isValidEmail(formData.email)) nextErrors.email = 'Email format is invalid.';
    if (formData.phone && !isValidPhone(formData.phone)) nextErrors.phone = 'Phone number must be in US format.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    // Store submission
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
      alert('There was a problem submitting the form. Please try again later.');
      setSubmitting(false);
      return;
    }

    // Send email to effective destination
    let emailStatus = 'pending';
    let emailResponseId: string | null = null;
    let emailError: string | null = null;

    try {
      const res = await fetch('/api/send-contact-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [effectiveEmail],
          subject: `New Contact Form Submission from ${siteSlug}`,
          message: `
New contact form submission from ${siteSlug}:

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
      .update({ email_status: emailStatus, email_response_id: emailResponseId, email_error: emailError })
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
    <ThemeScope mode={colorMode} className={`${isLight ? 'bg-white' : 'dark:bg-neutral-950'} rounded-lg p-4`}>
      <section id={anchorId} data-contact-anchor className="contents">
        <SectionShell compact className="rounded-lg p-0">
          <h2
            className={`text-center text-2xl font-bold mb-6 p-4 rounded-md ${
              isLight ? 'text-blue-900 bg-white' : 'text-white dark:bg-neutral-950'
            }`}
          >
            {title}
          </h2>

          {showEmailNudge && (
            <div className="mx-4 mb-4 rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200">
              No valid contact email is configured on the site.{' '}
              <button onClick={openIdentityPanel} className="underline">
                Set it in Template Identity
              </button>
              {hasValidEmail && ' (using block-level fallback for now)'}
            </div>
          )}

          {submitted ? (
            <p className={isLight ? 'text-green-600 text-center' : 'text-green-500 text-center'}>
              Thank you! Your submission has been received.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className={`space-y-4 p-4 ${isLight ? 'text-black' : 'text-white'}`}>
              <div>
                <label className="block font-semibold mb-1">Name:</label>
                <input type="text" name="name" className={inputClass(!!errors.name)} value={formData.name} onChange={handleChange} />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block font-semibold mb-1">Email:</label>
                <input type="email" name="email" className={inputClass(!!errors.email)} value={formData.email} onChange={handleChange} />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
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
                  onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                />
                {(errors.phone || errors.contact) && <p className="text-red-500 text-sm mt-1">{errors.phone || errors.contact}</p>}
              </div>

              {/* Options prefer DB, fallback to block content */}
              <div>
                <label className="block font-semibold mb-1">I&apos;m Interested In:</label>
                {renderedServices.length === 0 ? (
                  <div className="text-red-500 text-sm italic bg-red-900/10 border border-red-500/30 rounded px-3 py-2">
                    No services configured. This form prefers <code>template.services</code> and falls back to the block’s own items.
                  </div>
                ) : (
                  <select name="service" className={inputClass()} value={formData.service} onChange={handleChange} required>
                    <option value="">Select a service</option>
                    {renderedServices.map((s) => (
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
                  disabled={submitting || renderedServices.length === 0 || !hasValidEmail}
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
