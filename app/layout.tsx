export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

import '@/styles/globals.css';
import { getSessionContext } from '@/lib/supabase/getSessionContext';
import { redirect } from 'next/navigation';
import AdminLayout from '@/components/layouts/admin-layout';
import ViewerLayout from '@/components/layouts/viewer-layout';
import AppHeader from '@/components/admin/AppHeader/app-header';
import { eachMinuteOfInterval } from 'date-fns';

export const metadata = {
  metadataBase: new URL('https://quicksites.ai'), // Prevent OG image warning
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role } = await getSessionContext();

  const Layout =
    ['admin', 'owner', 'reseller'].includes(role) ? AdminLayout : ViewerLayout;

  return (
    <html lang="en" className="dark"> {/* 👈 Ensures dark mode tokens apply */}
      <head />
      <body className="bg-background text-foreground min-h-screen">
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
          <main className="flex items-center justify-center h-screen text-center">
            <div className="space-y-6">
              <h1 className="text-4xl font-extrabold">Welcome to QuickSites</h1>
              <p className="text-muted-foreground text-lg">
                Your one-click local site is moments away.
              </p>
              {children}
            </div>
          </main>
        )}
      </body>
    </html>
  );
}
