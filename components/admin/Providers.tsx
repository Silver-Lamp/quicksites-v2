'use client';

import { ReactNode } from 'react';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from '@/admin/lib/supabaseClient';
import { SmartLinkProvider } from '@/components/admin/SmartLinkProvider';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from 'next-themes';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionContextProvider supabaseClient={supabase}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <SmartLinkProvider>
        <Toaster />
        {children}
      </SmartLinkProvider>
    </ThemeProvider>
    </SessionContextProvider>
  );
}
