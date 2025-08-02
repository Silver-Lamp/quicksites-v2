// app/layout.tsx

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

import '@/styles/globals.css';

import { SessionProvider } from '@/lib/providers/SessionProvider';
import { Toaster } from 'react-hot-toast';
import DevToolsWidget from '@/components/dev-tools-widget';
import { PanelProvider } from '@/components/ui/panel-context';
import SquatBotPanel from '@/components/dev/squat-bot-panel';
import BlockInspectorOverlay from '@/components/dev/block-inspector-overlay';
import { TooltipProvider } from '@/components/ui/tooltip';
import ThemeScope from '@/components/ui/theme-scope';

const isProd = process.env.NODE_ENV === 'production';

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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>QuickSites | One-Click Local Websites</title>
      </head>
      <body className="bg-background text-foreground min-h-screen">
        <Toaster position="top-center" />
        <SessionProvider>
          <PanelProvider>
            <TooltipProvider>
              <ThemeScope mode="dark">
                {children}
                {!isProd && <SquatBotPanel />}
                {!isProd && <BlockInspectorOverlay />}
              </ThemeScope>
            </TooltipProvider>
          </PanelProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
