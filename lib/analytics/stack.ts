// lib/analytics/stack.ts
//
// The analytics stack, declared once: which systems exist, what each records, where it sends it,
// and whether it drops automated visitors. `/admin/analytics` draws its diagram from this and
// nothing else.
//
// ⚠️ WHY A REGISTRY AND NOT A DRAWING. A hand-drawn architecture diagram is true on the day it is
// drawn and silently wrong afterwards — CLAUDE.md §4's whole lesson ("write the command, not the
// count"). Two mechanisms keep this one honest, and neither is diligence:
//   1. `lib/analytics/__tests__/stack.test.ts` greps the repo for every file importing an
//      analytics SDK and FAILS if one is not declared here. Add a sixth call site and the build
//      goes red until the diagram knows about it.
//   2. Live status (`describeAnalyticsStack`) is read from the running process at render —
//      env-key PRESENCE, never values (rule 7b) — so a page that says "collecting" is saying it
//      about this deploy, not about a config file someone edited once.
//
// The one thing this file cannot know is whether the vendor is actually ingesting: PostHog and
// Vercel both accept a beacon and decide later. `status: 'configured'` means we are sending.

/** The SDKs whose presence in a file means "this is an analytics call site". */
export const ANALYTICS_SDK_IMPORTS = ['posthog-js', 'posthog-node', '@vercel/analytics'] as const;

export type AutomationFilter = 'skip_init' | 'before_send' | 'wrapper' | 'none';

export type AnalyticsSystem = {
  id: string;
  label: string;
  vendor: 'PostHog' | 'Vercel';
  /** Where the event is emitted from. Server events are authoritative; client events are not. */
  side: 'client' | 'server';
  /** One line, in plain words, of what this system records. */
  records: string;
  /** Repo paths that implement it. Existence is asserted by the guard test. */
  sources: string[];
  /** Env keys this needs. PRESENCE is reported; a value is never read into the page. */
  envKeys: string[];
  /** How automated visitors are kept out — the rule every system here must honour. */
  automation: AutomationFilter;
  /** Where the data lands, as a person would name it. */
  destination: string;
  /** External console, for the "go look" link. */
  consoleUrl: string;
};

export const ANALYTICS_SYSTEMS: AnalyticsSystem[] = [
  {
    id: 'posthog_server',
    label: 'PostHog (server)',
    vendor: 'PostHog',
    side: 'server',
    records:
      'The money funnel, at the authoritative transition — signup through platform_fee_collected, commissions, CRM buyer events. Fires when the database changes, not when a button is clicked.',
    sources: ['lib/analytics/posthog-server.ts', 'lib/analytics/events.ts', 'lib/analytics/funnel.ts'],
    envKeys: ['POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_KEY'],
    automation: 'none',
    destination: 'PostHog — funnels, cohorts, person profiles',
    consoleUrl: 'https://us.posthog.com',
  },
  {
    id: 'posthog_client',
    label: 'PostHog (browser)',
    vendor: 'PostHog',
    side: 'client',
    records:
      'Pageviews on App Router navigation, autocapture, sessions, page-leave. Respects Do Not Track.',
    sources: ['components/analytics/posthog-provider.tsx'],
    envKeys: ['NEXT_PUBLIC_POSTHOG_KEY'],
    automation: 'skip_init',
    destination: 'PostHog — same project as the server events',
    consoleUrl: 'https://us.posthog.com',
  },
  {
    id: 'vercel_analytics',
    label: 'Vercel Web Analytics',
    vendor: 'Vercel',
    side: 'client',
    records:
      'Pageviews, referrer, device, top paths. Duplicates PostHog’s pageview half on purpose — a second source that survives a missing PostHog key.',
    sources: ['components/analytics/vercel-analytics.tsx', 'app/layout.tsx'],
    // Vercel injects the endpoint at the edge; there is no key to set, which is why this list is
    // empty rather than missing. An empty list means "nothing to configure", not "unconfigured".
    envKeys: [],
    automation: 'before_send',
    destination: 'Vercel dashboard — Analytics tab',
    consoleUrl: 'https://vercel.com/point-seven-studio/quicksites-v2/analytics',
  },
  {
    id: 'vercel_events',
    label: 'Vercel custom events',
    vendor: 'Vercel',
    side: 'client',
    records:
      'Named product events from client components (landing_page_viewed and friends), sent through the wrapper so a new call site inherits the filter.',
    sources: ['lib/analytics/trackEvent.ts', 'lib/analytics/syntheticTraffic.ts'],
    envKeys: [],
    automation: 'wrapper',
    destination: 'Vercel dashboard — Analytics → Events',
    consoleUrl: 'https://vercel.com/point-seven-studio/quicksites-v2/analytics',
  },
];

export const AUTOMATION_LABEL: Record<AutomationFilter, string> = {
  skip_init: 'skips init entirely',
  before_send: 'beforeSend → null',
  wrapper: 'wrapper drops it',
  none: 'server-side (no browser)',
};

export type SystemStatus = {
  system: AnalyticsSystem;
  /** 'configured' = we are sending. Never "the vendor is ingesting" — we cannot see that. */
  status: 'configured' | 'not_configured';
  /** Which of `envKeys` are present in THIS process. Names only; values are never read out. */
  envPresent: string[];
  envMissing: string[];
};

/**
 * Resolve each system against the running process. `env` is injectable so the guard test can
 * assert both branches without mutating process.env.
 */
export function describeAnalyticsStack(env: Record<string, string | undefined> = process.env): SystemStatus[] {
  return ANALYTICS_SYSTEMS.map((system) => {
    const envPresent = system.envKeys.filter((k) => !!(env[k] ?? '').trim());
    const envMissing = system.envKeys.filter((k) => !(env[k] ?? '').trim());
    // No keys required → configured by construction (Vercel injects its own endpoint).
    // Any key present → configured (the two PostHog names are alternatives, not both required).
    const status: SystemStatus['status'] =
      system.envKeys.length === 0 || envPresent.length > 0 ? 'configured' : 'not_configured';
    return { system, status, envPresent, envMissing };
  });
}

/** Every distinct repo path the registry claims. Used by the guard test and the page's links. */
export function declaredSourceFiles(): string[] {
  return Array.from(new Set(ANALYTICS_SYSTEMS.flatMap((s) => s.sources))).sort();
}
