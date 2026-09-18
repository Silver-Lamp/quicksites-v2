'use client';

// components/analytics/vercel-analytics.tsx
//
// Vercel Web Analytics (pageviews + custom events), mounted once from the root layout.
//
// ⚠️ WHY THIS IS A WRAPPER AND NOT `<Analytics />` DIRECTLY. Automated visitors must not be
// counted as customers — the rule this codebase already enforces for PostHog
// (components/analytics/posthog-provider.tsx skips init entirely for automation) and for custom
// events (lib/analytics/syntheticTraffic.ts#track). HiveJournal's persona testers browse our
// public surfaces by arrangement, and our own Playwright runs hit production several times a day;
// 22 persona sessions landed in analytics as real visitors on the first day of that programme.
// Mounting the bare component would re-open exactly that hole for pageviews.
//
// `beforeSend` returning null drops the event client-side, so nothing is sent at all. It cannot
// skip loading the script the way the PostHog provider skips init — the component owns its own
// script tag — but no event leaves the browser.
//
// ⚠️ OVERLAP WITH POSTHOG IS REAL AND DELIBERATE. PostHog already captures pageviews, autocapture
// and sessions client-side, plus the authoritative money-funnel events server-side
// (lib/analytics/events.ts). Vercel Web Analytics duplicates the PAGEVIEW half. It is kept as a
// second, low-effort source of truth that survives a missing NEXT_PUBLIC_POSTHOG_KEY and reads
// without building an insight. If that duplication stops being worth its cost, delete this file
// and its one mount in app/layout.tsx — nothing else imports it.

import { Analytics } from '@vercel/analytics/next';
import { isSyntheticVisitor } from '@/lib/analytics/syntheticTraffic';

export default function VercelAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        // Personas and Playwright are welcome; they are simply not customers.
        if (isSyntheticVisitor()) return null;
        return event;
      }}
    />
  );
}
