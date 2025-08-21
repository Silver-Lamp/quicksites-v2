'use client';

import { Toaster } from 'react-hot-toast';
import { SessionProvider } from '@/lib/providers/SessionProvider';
import { PanelProvider } from '@/components/ui/panel-context';
import { TooltipProvider } from '@/components/ui/tooltip';
import ThemeScope from '@/components/ui/theme-scope';
import SupabaseProvider from '@/components/supabase-provider';
import DevToolsWidget from '@/components/dev-tools-widget';
import SquatBotPanel from '@/components/dev/squat-bot-panel';
import BlockInspectorOverlay from '@/components/dev/block-inspector-overlay';
import { CurrentUserProvider } from '@/components/admin/context/current-user-provider';

const isProd = process.env.NODE_ENV === 'production';

export function Providers({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: any;
}) {
  return (
    <>
      <Toaster position="top-center" />
      <SessionProvider>
        <PanelProvider>
          <TooltipProvider>
            <ThemeScope mode="dark">
              <SupabaseProvider initialSession={initialSession}>
                <CurrentUserProvider>
                  {children}
                  {/* {!isProd && <SquatBotPanel />}
                  {!isProd && <BlockInspectorOverlay />}
                  {!isProd && <DevToolsWidget />} */}
                </CurrentUserProvider>
              </SupabaseProvider>
            </ThemeScope>
          </TooltipProvider>
        </PanelProvider>
      </SessionProvider>
    </>
  );
}
