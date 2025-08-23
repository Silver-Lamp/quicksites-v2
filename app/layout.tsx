export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

import '@/styles/globals.css';
import type { Database } from '@/types/supabase';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Providers } from './providers';
import MagicLinkBridge from '@/components/auth/MagicLinkBridge';

export const metadata = { /* …your existing metadata… */ };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
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

  const { data: { session } } = await supa.auth.getSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <head><title>QuickSites | One-Click Local Websites</title></head>
      <body className="bg-background text-foreground min-h-screen">
        <MagicLinkBridge />
        <Providers initialSession={session}>{children}</Providers>
      </body>
    </html>
  );
}
