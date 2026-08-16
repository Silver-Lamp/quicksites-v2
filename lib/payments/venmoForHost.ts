// lib/payments/venmoForHost.ts
//
// Resolve the Venmo handle for whichever site the current request is on.
//
// The cart lives at /cart — an APP route, not a tenant site route — so it has no template in
// scope. But it is reached at the tenant's own host (renton-lemonade-fxny.quicksites.ai/cart),
// and that host is enough to find the site.
//
// Read-only and best-effort by design: a failure here must render a cart with no Venmo panel,
// never a cart that errors. The panel is an extra way to pay, not the page.

import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { readVenmoHandle } from './venmo';

/** The request's host, lowercased and without a port. */
async function currentHost(): Promise<string> {
  const h = await headers();
  const raw = h.get('x-forwarded-host') || h.get('host') || '';
  return raw.split(',')[0].trim().split(':')[0].toLowerCase();
}

export async function venmoHandleForCurrentHost(): Promise<string | null> {
  try {
    const host = await currentHost();
    if (!host) return null;

    // A custom domain is an exact match and wins — a site on its own domain is not addressed
    // by any subdomain label, so trying the label first would look up a slug like "www".
    const byDomain = await supabaseAdmin
      .from('templates')
      .select('data')
      .eq('custom_domain', host)
      .maybeSingle();
    if (byDomain.data) return readVenmoHandle((byDomain.data as any).data);

    // Platform host: <slug>.quicksites.ai / <slug>.delivered.menu / <slug>.lemonyum.com
    const label = host.split('.')[0];
    if (!label || label === 'www') return null;

    const bySlug = await supabaseAdmin
      .from('templates')
      .select('data')
      .eq('slug', label)
      .maybeSingle();
    return bySlug.data ? readVenmoHandle((bySlug.data as any).data) : null;
  } catch {
    return null;
  }
}
