'use client';

import type { Block } from '@/admin/lib/zod/blockSchema';
import SectionShell from '@/components/ui/section-shell';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function ContactFormRender({
  block,
  template,
}: {
  block: Block;
  template: { data?: { services?: string[] } };
}) {
  function getSiteSlugFromHostname(hostname: string): string {
    if (hostname.endsWith('.quicksites.ai')) {
      return hostname.split('.')[0];
    } else {
      const parts = hostname.replace(/^www\./, '').split('.');
      return parts.length >= 2 ? parts[0] : hostname;
    }
  }

  const siteSlug =
    typeof window !== 'undefined'
      ? getSiteSlugFromHostname(window.location.hostname)
      : 'unknown';

  const {
    title = 'Contact Us',
    notification_email = 'sandon@quicksites.ai',
    services = [],
  } = block.content || {};

  const templateServices = template?.data?.services || [];
  const fallbackServices = [
    'Towing',
    'Roadside Assistance',
    'Battery Jumpstart',
    'Lockout Service',
  ];

  const renderedServices =
    services.length > 0
      ? services
      : templateServices.length > 0
      ? templateServices
      : fallbackServices;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service: '',
    title,
    notification_email,
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; contact?: string; email?: string; phone?: string }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({});
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhone = (phone: string) => /^\(\d{3}\) \d{3}-\d{4}$/.test(phone);

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    return digits.replace(/(\d{0,3})(\d{0,3})(\d{0,4})/, (_, a, b, c) =>
      [a && `(${a}`, b && `) ${b}`, c && `-${c}`].filter(Boolean).join('')
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};
    if (!formData.name) newErrors.name = 'Name is required.';
    if (!formData.email && !formData.phone) newErrors.contact = 'Please provide either an email or phone number.';
    if (formData.email && !isValidEmail(formData.email)) newErrors.email = 'Email format is invalid.';
    if (formData.phone && !isValidPhone(formData.phone)) newErrors.phone = 'Phone number must be in US format.';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);

    const { data, error: insertError } = await supabase
      .from('form_submissions')
      .insert([{ ...formData, site_slug: siteSlug }])
      .select()
      .single();

    if (insertError || !data) {
      console.error('Insert error:', insertError);
      alert('There was a problem submitting the form. Please try again later.');
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
          to: [notification_email, 'sandon@quicksites.ai'],
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

      const json = await res.json();
      if (res.ok && json.success) {
        emailStatus = 'sent';
        emailResponseId = json.id || null;
      } else {
        emailStatus = 'error';
        emailError = json.error || 'Unknown email error';
      }
    } catch (err: any) {
      console.error('Resend error:', err);
      emailStatus = 'error';
      emailError = err.message || 'Unexpected exception';
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
    setFormData({ name: '', email: '', phone: '', service: '', title, notification_email });
  };

  return (
    <SectionShell className="bg-white dark:bg-neutral-900 text-black dark:text-white rounded border-2 border-yellow-400 max-w-md mx-auto p-6">
      <h2 className="text-center text-2xl font-bold text-blue-900 dark:text-white mb-6">{title}</h2>

      {submitted ? (
        <p className="text-green-500 text-center">Thank you! Your submission has been received.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">Name:</label>
            <input
              type="text"
              name="name"
              className={`w-full border rounded px-3 py-2 bg-white dark:bg-neutral-800 text-black dark:text-white ${errors.name ? 'border-red-500' : ''}`}
              value={formData.name}
              onChange={handleChange}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block font-semibold mb-1">Email:</label>
            <input
              type="email"
              name="email"
              className={`w-full border rounded px-3 py-2 bg-white dark:bg-neutral-800 text-black dark:text-white ${errors.email ? 'border-red-500' : ''}`}
              value={formData.email}
              onChange={handleChange}
            />
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
              className={`w-full border rounded px-3 py-2 bg-white dark:bg-neutral-800 text-black dark:text-white ${errors.phone || errors.contact ? 'border-red-500' : ''}`}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
            />
            {(errors.phone || errors.contact) && (
              <p className="text-red-500 text-sm mt-1">{errors.phone || errors.contact}</p>
            )}
          </div>
          <div>
            <label className="block font-semibold mb-1">I&apos;m Interested In:</label>
            <select
              name="service"
              className="w-full border rounded px-3 py-2 bg-white dark:bg-neutral-800 text-black dark:text-white"
              value={formData.service}
              onChange={handleChange}
              required
            >
              <option value="">Select a service</option>
              {renderedServices.map((s: string) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-center gap-4 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-900 text-white px-6 py-2 rounded disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      )}
    </SectionShell>
  );
}
