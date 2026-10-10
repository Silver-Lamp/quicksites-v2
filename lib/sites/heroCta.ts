// lib/sites/heroCta.ts
//
// What the hero's button DOES, decided once and purely.
//
// ⚠️ THE BUTTON ON 109 PUBLISHED SITES RELOADED THE HOME PAGE (found 2026-10-10). The scaffold's
// hero default was `cta_link: '/'` (three places: the block default, the zod normaliser and its
// schema default), the renderer read that as "go to page /", and so "Call Now" on
// vashon-electrical.com — and "Get a Free Quote" on every geo pitch site — navigated to the page
// the visitor was already on. Nothing errors when a button goes nowhere; the owner found it by
// clicking. Older sites carried a `tel:` link and worked, which is why it read as per-site.
//
// Rules, in order:
//   1. An explicit `cta_action` is respected.
//   2. Otherwise the link decides: `#contact`/`#` → contact form · `#x` → that anchor ·
//      `tel:` → call · `/` or empty → contact form (the dead default, never "go to /") ·
//      anything else → go to that page.
//   3. A contact-form jump whose label says "call" dials the site's phone when one resolves
//      ("Call Now" must call; the geo sites' phone is their tracking number).
//   4. A call with no phone falls back to the contact form rather than hiding the button.

export type HeroCtaAction = 'jump_to_contact' | 'jump_to_anchor' | 'go_to_page' | 'call_phone';

export type HeroCtaInput = {
  cta_action?: string | null;
  cta_link?: string | null;
  cta_text?: string | null;
  /** Digits only. The hero's own `cta_phone` first, else the template's phone. */
  phoneDigits?: string | null;
  /** The contact block's anchor id; the public render gives the first contact_form `id="contact"`. */
  contactAnchor?: string | null;
};

export type HeroCta = { action: HeroCtaAction; href: string | undefined };

const ACTIONS = new Set<string>(['jump_to_contact', 'jump_to_anchor', 'go_to_page', 'call_phone']);

/** Rule 2: the action a link implies when the author set none. */
export function deriveCtaAction(link: string | null | undefined): HeroCtaAction {
  const l = String(link ?? '').trim();
  if (l === '' || l === '/' || l === '#' || l === '#contact') return 'jump_to_contact';
  if (l.startsWith('#')) return 'jump_to_anchor';
  if (l.toLowerCase().startsWith('tel:')) return 'call_phone';
  return 'go_to_page';
}

/**
 * The site's phone, digits only, from wherever the data actually carries it.
 *
 * ⚠️ `templates.phone` is a COLUMN and the public render serves a SNAPSHOT (`published_sites` →
 * `template_versions.data`), which has no columns — so on the live site `template.phone` was
 * undefined and "Call Now" fell through to the contact form even though the tracking number
 * sat in `data.meta.contact.phone`, which is exactly where `pushTrackingNumberToSite` writes it.
 * Same paths that push walks: `meta.contact`, `identity.contact`, `meta.identity.contact`.
 */
export function phoneFromSite(site: unknown): string {
  const s = (site ?? {}) as Record<string, any>;
  const data = (typeof s.data === 'string' ? safeJson(s.data) : s.data) ?? {};
  const candidates: unknown[] = [
    s.phone,
    data?.meta?.contact?.phone,
    data?.identity?.contact?.phone,
    data?.meta?.identity?.contact?.phone,
    data?.meta?.phone,
  ];
  for (const c of candidates) {
    const digits = String(c ?? '').replace(/\D/g, '');
    if (digits.length >= 10) return digits;
  }
  return '';
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

export function resolveHeroCta(input: HeroCtaInput): HeroCta {
  const link = String(input.cta_link ?? '').trim();
  const phone = String(input.phoneDigits ?? '').replace(/\D/g, '');
  const anchor = `#${(input.contactAnchor || 'contact').toString().replace(/^#/, '')}`;
  let action: HeroCtaAction = ACTIONS.has(String(input.cta_action ?? '')) ? (input.cta_action as HeroCtaAction) : deriveCtaAction(link);

  // Rule 3: "Call Now" calls, when there is a number to call.
  if (action === 'jump_to_contact' && phone && /\bcall\b/i.test(String(input.cta_text ?? ''))) action = 'call_phone';
  // Rule 4: a call with nothing to dial still goes somewhere useful.
  if (action === 'call_phone' && !phone) action = 'jump_to_contact';

  switch (action) {
    case 'call_phone':
      return { action, href: `tel:${phone}` };
    case 'jump_to_contact':
      return { action, href: anchor };
    case 'jump_to_anchor':
      return { action, href: link };
    default:
      return { action: 'go_to_page', href: link && link !== '/' ? link : '/contact' };
  }
}
