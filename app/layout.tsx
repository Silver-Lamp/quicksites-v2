// app/layout.tsx
// Use RootLayout() when you need to wrap your app with the session context
// Use getSessionContext() when you need the user context

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

import '@/styles/globals.css';

import AdminLayout from '@/components/layouts/admin-layout';
import ViewerLayout from '@/components/layouts/viewer-layout';
import AppHeader from '@/components/admin/AppHeader/app-header';
import UnauthenticatedLayout from '@/components/layouts/unauthenticated-layout';
import { SessionProvider } from '@/lib/providers/SessionProvider';

import { getSessionContext } from '@/lib/supabase/getSessionContext';

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
  const { user, role } = await getSessionContext();

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
                  avatar_url: user.avatar_url ?? '',
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
