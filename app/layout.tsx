// app/layout.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Note: preferredRegion is only honored by the Edge runtime; harmless on Node.
export const preferredRegion = 'iad1';

import '@/styles/globals.css';
import '@/styles/qs-typography.css';

import * as React from 'react';
import type { Metadata, Viewport } from 'next';
import type { Database } from '@/types/supabase';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Providers } from './providers';

import MagicLinkBridge from '@/components/auth/MagicLinkBridge';
import RouteChangeOverlayClient from '@/components/ui/RouteChangeOverlayClient';
import CartEventsWire from '@/components/cart/cart-events-wire';
import CartFab from '@/components/cart/cart-fab';
import { resolveOrg } from '@/lib/org/resolveOrg';

/* ---------------- Metadata / Viewport ---------------- */

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' }, // matches --background in light
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },  // near-black dark bg
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const org = await resolveOrg();
  const title = `${org?.name ?? 'QuickSites'} | One-Click Local Websites`;
  return {
    title,
    icons: org?.favicon_url ? { icon: [{ url: org.favicon_url }] } : undefined,
    // You can expand here with openGraph/twitter as needed.
  };
}

/* ---------------- Root Layout ---------------- */

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve org for white-labeling and Providers
  const org = await resolveOrg();

  // Server-side Supabase session (read-only; no cookie mutations here)
  const jar = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        get: (name) => jar.get(name)?.value,
        set: () => undefined,
        remove: () => undefined,
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Allow both color schemes; components can opt into light-only when needed */}
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/10">
        {/* Pages Router navigations (anti-flash timing built-in) */}
        <RouteChangeOverlayClient showDelayMs={120} minVisibleMs={350} />

        {/* Bridges / global clients */}
        <MagicLinkBridge />

        {/* App providers (theme, session, org, etc.) */}
        <Providers initialSession={session} org={org}>
          <CartEventsWire />
          {children}
          <CartFab />
        </Providers>
      </body>
    </html>
  );
}
