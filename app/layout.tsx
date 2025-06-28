export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

import '@/styles/globals.css';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

import AdminLayout from '@/components/layouts/admin-layout';
import ViewerLayout from '@/components/layouts/viewer-layout';
import AppHeader from '@/components/admin/AppHeader/app-header';
import { SessionProvider } from '@/lib/providers/SessionProvider';
import UnauthenticatedLayout from '@/components/layouts/unauthenticated-layout';

console.log('[🧪 cookies() instanceof]', typeof cookies);

try {
  const cookieStore = await cookies(); // ✅ Await the promise
  console.log('[🍪 Possible offender]', cookieStore.get('sb-...'));
} catch (err) {
  console.warn('[⚠️ cookies() access warning]', (err as Error).message);
}

export const metadata = {
  metadataBase: new URL('https://quicksites.ai'),
  title: 'QuickSites | One-Click Local Websites',
  description: 'Launch your website in minutes with QuickSites.ai — no code needed.',
  openGraph: {
    title: 'QuickSites | One-Click Local Websites',
    description: 'Launch your website in minutes with QuickSites.ai — no code needed.',
    url: 'https://quicksites.ai',
    siteName: 'QuickSites.ai',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'QuickSites AI Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerComponentClient<Database>({
    cookies,
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = 'viewer';
  if (user?.id) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    role = profile?.role ?? 'viewer';
  }

  const Layout = ['admin', 'owner', 'reseller'].includes(role)
    ? AdminLayout
    : ViewerLayout;
    
  return (
    <html lang="en" className="dark">
      <head />
      <body className="bg-background text-foreground min-h-screen">
        <SessionProvider>
          {user ? (
            <>
              <AppHeader
                user={{
                  id: user.id,
                  email: user.email ?? '',
                  avatar_url: user.user_metadata?.avatar_url ?? '',
                }}
                role={role}
              />
              <Layout>{children}</Layout>
            </>
          ) : (
            <UnauthenticatedLayout>{children}</UnauthenticatedLayout>
          )}
        </SessionProvider>
      </body>
    </html>
  );
}
