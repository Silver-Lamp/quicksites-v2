// app/layout.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

import '@/styles/globals.css';
import '@/styles/qs-typography.css';

import type { Database } from '@/types/supabase';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Providers } from './providers';

import MagicLinkBridge from '@/components/auth/MagicLinkBridge';
import RouteChangeOverlayClient from '@/components/ui/RouteChangeOverlayClient';
import { resolveOrg } from '@/lib/org/resolveOrg';
import CartEventsWire from '@/components/cart/cart-events-wire';
import CartFab from '@/components/cart/cart-fab'; // ← client component, safe to import in server layout

import * as React from 'react';

export const metadata = { /* …your existing metadata… */ };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve current organization (supports dev override via qs_org_slug)
  const org = await resolveOrg();

  // Get Supabase session (server-side)
  const store = await cookies();
  const supa = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        get: (name) => store.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  );
  const { data: { session } } = await supa.auth.getSession(); // ← bracket fix

  return (
    <html lang="en" suppressHydrationWarning className="scrollbar-stable">
      <head>
        <title>{`${org.name} | One-Click Local Websites`}</title>
        <link rel="icon" href={org.favicon_url ?? '/favicon.ico'} />
      </head>
      <body className="bg-background text-foreground min-h-screen">
        {/* Pages Router navigations (anti-flash timing built-in) */}
        <RouteChangeOverlayClient showDelayMs={120} minVisibleMs={350} />

        <MagicLinkBridge />

        {/* Pass org into Providers for white-label branding */}
        <Providers initialSession={session} org={org}>
          {/* Cart event bridge -> pushes qs:cart:add into Zustand */}
          <CartEventsWire />

          {/* App content */}
          {children}

          {/* Mobile floating cart button (client-only) */}
          <CartFab />
        </Providers>
      </body>
    </html>
  );
}
