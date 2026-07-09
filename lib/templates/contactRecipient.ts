// lib/templates/contactRecipient.ts
//
// Server-side resolution of a site's contact-form recipient from its slug.
//
// Security: the public /api/send-contact-email endpoint must NOT trust a
// client-supplied `to`, or it becomes an open email relay (any address, any
// body). The authoritative recipient is the business email configured on the
// template — mirror the same field precedence the renderer uses
// (components/admin/templates/render-blocks/contact-form.tsx) but read it from
// the DB row server-side.

import type { SupabaseClient } from '@supabase/supabase-js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(x: unknown): x is string {
  return typeof x === 'string' && EMAIL_RE.test(x.trim());
}

/** Deep get by dotted path, object-safe. */
function dget(o: any, path: string): unknown {
  return path
    .split('.')
    .reduce((acc, k) => (acc && typeof acc === 'object' ? (acc as any)[k] : undefined), o);
}

/**
 * Pure: derive the contact recipient from a template row, preferring the
 * top-level column then the nested meta/contact paths where the editor mirrors
 * it. Returns a normalized (trimmed, lowercased) address or null.
 */
export function pickContactEmail(row: any): string | null {
  if (!row) return null;
  const candidates = [
    row.contact_email,
    dget(row, 'data.meta.contact_email'),
    dget(row, 'data.meta.contact.email'),
    dget(row, 'data.contact.email'),
    dget(row, 'data.meta.identity.contact.email'),
  ];
  for (const c of candidates) {
    if (isEmail(c)) return String(c).trim().toLowerCase();
  }
  return null;
}

/**
 * Look up the template by slug (service-role client — public visitors are
 * anonymous) and derive its contact recipient. Returns null when the site is
 * unknown or has no valid contact email configured.
 */
export async function resolveContactRecipient(
  supabase: SupabaseClient,
  slug: string
): Promise<string | null> {
  const clean = (slug ?? '').trim();
  if (!clean) return null;

  const { data, error } = await supabase
    .from('templates')
    .select('contact_email, data')
    .eq('slug', clean)
    .maybeSingle();

  if (error) {
    console.error(`[resolveContactRecipient] ${error.message}`);
    return null;
  }
  return pickContactEmail(data);
}
