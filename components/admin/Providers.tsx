'use client';

import { ReactNode, useEffect, useState } from 'react';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from '@/admin/lib/supabaseClient';
import { SmartLinkProvider } from '@/components/admin/smart-link-provider';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider as NextThemes } from 'next-themes';
import { GoogleFontLoader } from '@/components/google-font-loader';
import { ThemeProvider as AppThemeProvider } from '@/hooks/useThemeContext';

export default function Providers({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return (
    <SessionContextProvider supabaseClient={supabase}>
      <NextThemes attribute="class" defaultTheme="dark" enableSystem>
        <AppThemeProvider siteSlug="default">
          <SmartLinkProvider>
            <Toaster />
            <GoogleFontLoader />
            {children}
          </SmartLinkProvider>
        </AppThemeProvider>
      </NextThemes>
    </SessionContextProvider>
  );
}
