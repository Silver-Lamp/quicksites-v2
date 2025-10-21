'use client';

import { ReactNode, useEffect, useState } from 'react';
import { SessionContextProvider, SupabaseClient } from '@supabase/auth-helpers-react';
import { supabase } from '@/admin/lib/supabaseClient';
import { SmartLinkProvider } from '@/components/admin/smart-link-provider';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider as NextThemes } from 'next-themes';
import { GoogleFontLoader } from '@/components/google-font-loader';
import { ThemeProvider as AppThemeProvider } from '@/hooks/useThemeContext';
import { Database } from '@/types/supabase';

export default function Providers({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return (
    <SessionContextProvider supabaseClient={supabase as unknown as SupabaseClient<Database, "public", "public">}>
      <NextThemes attribute="class" defaultTheme="dark" enableSystem>
        <AppThemeProvider siteSlug="default">
          <SmartLinkProvider>{children}</SmartLinkProvider>
        </AppThemeProvider>
      </NextThemes>
    </SessionContextProvider>
  );
}
