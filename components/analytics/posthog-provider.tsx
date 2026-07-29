'use client';

// components/analytics/posthog-provider.tsx
//
// Client-side PostHog. Initializes posthog-js (autocapture + manual pageviews)
// and exposes the React context provider. No-ops when NEXT_PUBLIC_POSTHOG_KEY
// is unset, so local dev without analytics keys works unchanged.
import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { isSyntheticVisitor } from '@/lib/analytics/syntheticTraffic';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

function initPostHog() {
  if (initialized || typeof window === 'undefined' || !POSTHOG_KEY) return;
  // Never initialise for automation. HiveJournal's persona testers browse these exact public
  // surfaces by arrangement, and every one of their sessions was being counted as a real
  // visitor — inflating sessions and depressing the conversion rates the money funnel
  // reports on. Skipping init (rather than filtering events later) means no identity, no
  // session, no pageview and no autocapture: nothing to clean up afterwards.
  if (isSyntheticVisitor()) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // we send pageviews manually on route change below
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    // Respect Do Not Track; tighten further per privacy review before GA.
    respect_dnt: true,
  });
  initialized = true;
}

/** Fires a manual pageview on App Router navigations (incl. query changes). */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (!POSTHOG_KEY || typeof window === 'undefined') return;
    if (isSyntheticVisitor()) return; // init was skipped; don't queue events against no client
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    initPostHog();
  }, []);

  // Without a key, render children untouched (no provider needed).
  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <React.Suspense fallback={null}>
        <PageviewTracker />
      </React.Suspense>
      {children}
    </PHProvider>
  );
}
