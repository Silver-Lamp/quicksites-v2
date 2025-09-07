'use client';

import * as React from 'react';
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

/* -----------------------------------------------------------------------------
 * Organization context (white-label)
 * -------------------------------------------------------------------------- */

export type Org = {
  id: string;
  slug: string;
  name: string;
  logo_url?: string | null;
  dark_logo_url?: string | null;
  favicon_url?: string | null;
  theme_json?: any;
  support_email?: string | null;
  support_url?: string | null;
  billing_mode?: 'central' | 'reseller' | 'none' | null;
};

const DEFAULT_ORG: Org = {
  id: '00000000-0000-0000-0000-000000000000',
  slug: 'quicksites',
  name: 'QuickSites',
  logo_url: '/logo_v1.png', // ← make sure this exists
  dark_logo_url: '/logo_v1.png',
  favicon_url: null,
  theme_json: {},
  support_email: 'support@quicksites.ai',
  support_url: null,
  billing_mode: 'central',
};

export const OrgContext = React.createContext<Org | null>(null);

export function useOrg(): Org {
  const ctx = React.useContext(OrgContext);
  return ctx ?? DEFAULT_ORG;
}

/** Convenience branding hook so you can swap hard-coded “QuickSites”. */
export function useBrand() {
  const org = useOrg();
  return {
    name: org.name,
    slug: org.slug,
    logoUrl: org.logo_url ?? '/brand/default-logo.svg',
    darkLogoUrl: org.dark_logo_url ?? org.logo_url ?? '/brand/default-logo-dark.svg',
    faviconUrl: org.favicon_url ?? '/favicon.ico',
    theme: org.theme_json ?? {},
    supportEmail: org.support_email ?? 'support@example.com',
    supportUrl: org.support_url ?? null,
    billingMode: (org.billing_mode ?? 'central') as 'central' | 'reseller' | 'none',
  };
}

export function OrgProvider({
  org,
  children,
}: {
  org?: Org | null; // optional for backward-compat; falls back to DEFAULT_ORG
  children: React.ReactNode;
}) {
  return <OrgContext.Provider value={org ?? DEFAULT_ORG}>{children}</OrgContext.Provider>;
}

/* -----------------------------------------------------------------------------
 * App Providers
 * -------------------------------------------------------------------------- */

export function Providers({
  children,
  initialSession,
  org, // ← pass the resolved org from RootLayout
}: {
  children: React.ReactNode;
  initialSession: any;
  org?: Org | null;
}) {
  return (
    <>
      <Toaster position="top-center" />
      <SessionProvider>
        <PanelProvider>
          <TooltipProvider>
            <ThemeScope mode="dark">
              <SupabaseProvider initialSession={initialSession}>
                <OrgProvider org={org}>
                  <CurrentUserProvider>
                    {children}
                    {/* {!isProd && <SquatBotPanel />}
                    {!isProd && <BlockInspectorOverlay />}
                    {!isProd && <DevToolsWidget />} */}
                  </CurrentUserProvider>
                </OrgProvider>
              </SupabaseProvider>
            </ThemeScope>
          </TooltipProvider>
        </PanelProvider>
      </SessionProvider>
    </>
  );
}
