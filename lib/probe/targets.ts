// lib/probe/targets.ts
//
// What the probe watches. Money and front doors — the surfaces where being silently wrong costs a
// customer or a ranking. Deliberately short: a probe that goes red often gets ignored, which is
// the failure it exists to prevent.
//
// Every entry carries `because`, so a red run explains itself at 3am without archaeology.
import type { Check } from './checks';

/** Confirmed by the owner as a stable subject that will stay up (2026-08-18). */
export const TENANT_SUBJECT = 'https://renton-lemonade.quicksites.ai/';

export const CHECKS: Check[] = [
  {
    name: 'yardsale-front-door',
    url: 'https://yardsalesites.com/yard-sale/new',
    because:
      'This returned 200 while serving "We don\'t recognise that code" — the middleware treated the path as a sticker code. Every availability check said the route was fine.',
    mustNotContain: ['recognise that code', 'recognize that code'],
    mustContain: ['Make a page for your sale'],
    minElements: { h1: 1 },
    // The create form is the densest surface of native controls in the product, and native
    // controls follow the visitor's OS preference rather than our tokens — see #837.
    themes: ['light', 'dark'],
    expectColorScheme: 'light',
    // Read the CONTROL, not the document. See colorSchemeSelector — the root resolves "normal"
    // and a check pointed there passes without ever touching the thing that renders.
    colorSchemeSelector: 'input[type=checkbox]',
  },
  {
    name: 'yardsale-directory',
    url: 'https://yardsalesites.com/',
    because: 'The apex is the address we want to rank. It reaches the directory only through a rewrite, so a routing change can silently strand it.',
    mustContain: ['Garage sales near you'],
    minElements: { h1: 1 },
    themes: ['light', 'dark'],
    expectColorScheme: 'light',
    // No native controls on the directory, so the light scope itself is the honest subject.
    colorSchemeSelector: '[data-theme="light"]',
  },
  {
    name: 'tenant-site-ssr',
    url: TENANT_SUBJECT,
    because:
      'Tenant sites once served crawlers an empty shell (h1=0, a=0, p=0) while the marketing pages rendered fine — and the check that "verified" SSR was pointed at the marketing pages. This asserts the customer-facing instance.',
    minElements: { h1: 1, a: 3 },
    minTextChars: 400,
  },
  {
    name: 'tenant-og-image',
    url: 'https://www.quicksites.ai/api/og/renton-lemonade/image',
    because: 'This route stamped content-type from a cache FILENAME while serving different bytes, so it declared SVG and served PNG. curl showed a healthy 200 and a plausible size.',
    expectImage: 'png',
  },
  {
    name: 'restaurants-landing',
    url: 'https://www.quicksites.ai/restaurants',
    because: 'The vertical landing page, and now a force-dynamic route resolving a backdrop from storage at request time — a storage failure must degrade, never blank the page.',
    mustContain: ['We built your restaurant'],
    minElements: { h1: 1, p: 3 },
    minTextChars: 600,
  },
];
