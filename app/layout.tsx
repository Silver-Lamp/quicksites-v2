// app/layout.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

import '@/styles/globals.css';

import AdminLayout from '@/components/layouts/admin-layout';
import ViewerLayout from '@/components/layouts/viewer-layout';
import AppHeader from '@/components/admin/AppHeader/app-header';
import UnauthenticatedLayout from '@/components/layouts/unauthenticated-layout';
import { SessionProvider } from '@/lib/providers/SessionProvider';
import { getRequestContext } from '@/lib/request/getRequestContext';
import { Toaster } from 'react-hot-toast';
import DevToolsWidget from '@/components/dev-tools-widget';
import TraceViewer from '@/components/dev/trace-viewer';
import { getLayoutForRole } from '@/lib/roles/layoutForRole';

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
  const {
    userId = '',
    userEmail = '',
    role = 'guest',
    userAgent,
    ip,
    abVariant,
    sessionId,
    traceId,
  } = await getRequestContext();

  const Layout = getLayoutForRole(role);

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <title>QuickSites | One-Click Local Websites</title>
      </head>
      <body
        className="bg-background text-foreground min-h-screen"
        data-user-id={userId}
        data-user-email={userEmail}
        data-user-role={role}
        data-user-agent={userAgent}
        data-ip={ip}
        data-session-id={sessionId}
        data-ab-variant={abVariant}
        data-trace-id={traceId}
      >
        <Toaster position="top-center" />
        <SessionProvider>
          {userId ? (
            <>
              <AppHeader />
              <Layout>{children}</Layout>
            </>
          ) : (
            <UnauthenticatedLayout>{children}</UnauthenticatedLayout>
          )}
          {/* <DevToolsWidget minimized={true} /> */}
          <TraceViewer />
        </SessionProvider>
      </body>
    </html>
  );
}
