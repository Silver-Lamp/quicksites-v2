// app/sites/not-found.tsx
//
// The 404 for every tenant-site route — and, critically, the thing that makes it an ACTUAL 404.
//
// ⚠️ THE BUG THIS FIXES WAS A STATUS CODE, NOT A PAGE. `app/sites/[slug]/[[...rest]]/page.tsx`
// rendered `<MenuNotFound />` by returning it, which is a normal successful render: every missing
// restaurant on delivered.menu answered **HTTP 200** with a body that said "NOT FOUND". Checked
// against production — `kent-restaurant.delivered.menu`, `deliveredmenu.com/definitely-not-a-real-
// slug-xyz` and a nonsense subdomain all returned 200.
//
// A soft 404 costs twice. Search engines treat 200 as a real page, so every typo and every dead
// outreach link becomes an indexable thin page competing with the real ones; and any monitoring
// that checks status codes — ours included — is blind to the entire class. It is the same shape as
// the site exporter fetching a clean 200 of our own error page and handing it to a restaurant owner
// as proof they owned their site.
//
// The FIX has to preserve the original decision, which was right: a visitor on delivered.menu is
// looking for dinner, not for a website builder, so they get the restaurant directory rather than
// the platform sitemap. In the App Router the only way to keep a custom body *and* send 404 is
// `notFound()` plus a segment `not-found.tsx` — so the branch moved here and the page now throws.
import { headers } from 'next/headers';
import MenuNotFound from '@/components/site/menu-not-found';
import PlatformNotFound from '@/app/not-found';
import { PUBLIC_PATH_HEADER } from '@/lib/seo/canonicalUrl';

// A 404 must never be indexed; it would compete with the real pages for its own keywords.
export const metadata = { robots: { index: false, follow: true } };

/**
 * What the visitor typed, recovered from the request rather than from route params —
 * `not-found.tsx` receives no params, and middleware already records the pre-rewrite path
 * (the same header the canonical URLs are built from).
 */
function attemptedSlug(publicPath: string | null, host: string | null): string | null {
  const fromPath = (publicPath ?? '').split('/').filter(Boolean)[0];
  if (fromPath) return fromPath;
  // Bare subdomain: `kent-restaurant.delivered.menu/` has no path to read.
  const sub = (host ?? '').split(':')[0].split('.')[0];
  return sub && sub !== 'www' ? sub : null;
}

export default async function SitesNotFound() {
  const h = await headers();
  // Set by middleware for exactly this surface — see the `x-qsites-menu-host` branch there.
  const onMenuHost = h.get('x-qsites-menu-host') === '1';
  if (!onMenuHost) return <PlatformNotFound />;
  return <MenuNotFound attempted={attemptedSlug(h.get(PUBLIC_PATH_HEADER), h.get('host'))} />;
}
