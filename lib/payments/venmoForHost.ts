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
  return (await cartShellForSlug(slug)).venmoHandle;
}

export type CartShell = {
  venmoHandle: string | null;
  /** The site's own light/dark, so the cart does not arrive in the opposite theme. */
  colorMode: 'light' | 'dark';
};

/**
 * Everything the tenant cart/checkout needs about its site, in one read.
 *
 * ⚠️ COLOR MODE IS PART OF THIS BECAUSE THE CART IS NOT INSIDE THE SITE'S THEME SCOPE.
 * `TemplateThemeWrapper` establishes `[data-theme]` around the RENDERED BLOCKS; the cart and
 * checkout are returned by the site route before any of that, so they inherit the app chrome —
 * which is always dark (CLAUDE.md §7). A light restaurant site therefore handed its customer a
 * black cart halfway through ordering. Nothing was broken and nothing logged; it just looked
 * like a different website, at the exact moment a stranger decides whether to trust it.
 *
 * Defaults to dark to match the platform default, so a site with no explicit mode is unchanged.
 */
export async function cartShellForSlug(slug: string | null | undefined): Promise<CartShell> {
  const s = String(slug ?? '').trim();
  if (!s) return { venmoHandle: null, colorMode: 'dark' };
  try {
    const { data } = await supabaseAdmin
      .from('templates')
      .select('data, color_mode')
      .eq('slug', s)
      .maybeSingle();
    if (!data) return { venmoHandle: null, colorMode: 'dark' };
    const row = data as any;
    const mode = row.color_mode ?? row.data?.color_mode;
    return {
      venmoHandle: readVenmoHandle(row.data),
      colorMode: mode === 'light' ? 'light' : 'dark',
    };
  } catch {
    return { venmoHandle: null, colorMode: 'dark' };
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
