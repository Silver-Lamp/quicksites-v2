// lib/analytics/syntheticTraffic.ts
//
// Detects automated visitors so they don't land in product analytics.
//
// WHY THIS EXISTS: HiveJournal's persona testers browse our PUBLIC production surfaces
// (crosstalk/contracts/persona-testing.md) — the homepage, /compare, /gigs, /pricing and the
// delivered.menu drafts. Every one of those sessions was landing in PostHog and Vercel
// Analytics as a real visitor: inflating sessions, depressing conversion rate, and corrupting
// the money-funnel instrumentation (lib/analytics/events.ts) that the whole Model A dashboard
// is built on. 22 sessions in the first day.
//
// PorchHearth raised this as a product risk for persona testing generally — persona traffic
// pollutes the CUSTOMER's analytics, and "they're paying you to improve the numbers you'd be
// corrupting". We are the first customer, so we get to fix it first.
//
// THE LOAD-BEARING SIGNAL IS `navigator.webdriver`, not a user-agent string. It is set by
// every WebDriver-controlled browser (Playwright, which is what HJ drives, plus Puppeteer and
// Selenium), it is part of the HTML spec rather than a convention, and — critically — it
// requires no coordination with the other product. A UA marker is better documentation but
// worse enforcement: it only works once someone remembers to send it, and silently stops
// working the day they change it.
//
// This is deliberately NOT a bot-blocker. Personas are welcome; we asked them to come. They
// simply must not be counted as customers.

/** UA substrings that mean "not a person". Belt to `navigator.webdriver`'s braces. */
const AUTOMATION_UA = [
  'headlesschrome',
  'playwright',
  'puppeteer',
  'selenium',
  'phantomjs',
  'lighthouse',
  'chrome-lighthouse',
  'bot',
  'crawler',
  'spider',
  // HiveJournal's persona testers (HJ #1680). Their real UA is a genuine Chrome string with
  // `HiveJournalPersonaTesting/1.0 (+https://www.hivejournal.com/persona-testing)` appended —
  // the Chrome base is deliberate, since pages must render as they would for a real visit.
  //
  // ⚠️ The token is theirs, not ours. I originally guessed `quicksites-persona-tester`, which
  // never would have matched: the same UA serves their self-tests, our cross-mesh runs and
  // their paying customers, so a QS-specific token would be wrong on a stranger's site. Match
  // the string they actually send, and don't "correct" it to something QS-shaped.
  'hivejournalpersonatesting',
];

/**
 * True when this visitor is automation rather than a person.
 *
 * Safe to call during render: every branch is guarded for SSR, where there is no navigator
 * and the answer is "unknown", which we treat as human — under-filtering costs a little
 * analytics noise, over-filtering would silently delete real customers from the funnel.
 */
export function isSyntheticVisitor(): boolean {
  if (typeof navigator === 'undefined') return false;

  // 1. The strong signal. Spec'd, set by the automation stack itself, no coordination needed.
  if ((navigator as unknown as { webdriver?: boolean }).webdriver === true) return true;

  // 2. UA fallback — catches headless runners that mask webdriver, and gives HJ a way to
  //    self-identify explicitly.
  const ua = (navigator.userAgent || '').toLowerCase();
  return AUTOMATION_UA.some((needle) => ua.includes(needle));
}

/**
 * Drop-in replacement for `@vercel/analytics`'s `event.track` that skips automation.
 *
 * Import this instead of `@vercel/analytics` in client components. Three call sites were
 * firing product events (`landing_page_viewed` among them) on every persona browse; a wrapper
 * is used rather than three inline guards so the next call site inherits the behaviour
 * instead of re-deriving it.
 */
export function track(name: string, props?: Record<string, unknown>): void {
  if (isSyntheticVisitor()) return;
  // Imported lazily so this module stays usable from server code, where @vercel/analytics's
  // client entrypoint would blow up.
  void import('@vercel/analytics').then((m) => {
    (m.default as unknown as { track: (n: string, p?: Record<string, unknown>) => void }).track(
      name,
      props,
    );
  });
}

/**
 * Server-side counterpart, for routes that emit analytics from a request context.
 * Header-based only — there is no `navigator` on the server, so this is strictly weaker than
 * the client check and should not be relied on as the only filter.
 */
export function isSyntheticRequest(userAgent: string | null | undefined): boolean {
  const ua = (userAgent || '').toLowerCase();
  if (!ua) return false;
  return AUTOMATION_UA.some((needle) => ua.includes(needle));
}
