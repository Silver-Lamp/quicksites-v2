// lib/site/canonicalOrigin.ts
//
// Where the QuickSites ADMIN lives — deliberately separate from `publicBaseUrl()`.
//
// publicBaseUrl() falls back through APP_BASE_URL / NEXT_PUBLIC_APP_URL, and in this repo's
// own .env.example APP_BASE_URL is `https://delivered.menu` — the restaurant surface, not the
// product. Using it to build an editor link would send an operator to the wrong product
// entirely, and it would do so silently.
//
// So this is its own constant with its own override. `www.` is explicit because the apex
// 307-redirects, and an admin round trip shouldn't spend a hop on a redirect.

export const CANONICAL_ORIGIN = (
  process.env.QS_ADMIN_ORIGIN || 'https://www.quicksites.ai'
).replace(/\/+$/, '');
