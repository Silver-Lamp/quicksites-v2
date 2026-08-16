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

/**
 * Resolve by slug — the form that actually fires on a tenant site.
 *
 * ⚠️ ON A TENANT HOST THE CART IS NOT `app/cart`. Middleware rewrites
 * `<slug>.quicksites.ai/cart` → `/sites/<slug>/cart`, so the app route never runs and its
 * host-based lookup never happens. The first version of this feature shipped resolving the
 * handle in `app/cart/page.tsx` only, which meant it worked on the platform host and was
 * invisible on every site that has customers — the exact inverse of what was wanted, and it
 * looked like the handle had failed to save again.
 *
 * The site route already knows its slug, so pass it. No header sniffing, no rewrite to reason
 * about.
 */
export async function venmoHandleForSlug(slug: string | null | undefined): Promise<string | null> {
  const s = String(slug ?? '').trim();
  if (!s) return null;
  try {
    const { data } = await supabaseAdmin
      .from('templates')
      .select('data')
      .eq('slug', s)
      .maybeSingle();
    return data ? readVenmoHandle((data as any).data) : null;
  } catch {
    return null;
  }
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
