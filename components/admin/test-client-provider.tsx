// admin/components/TestClientProvider.tsx
'use client';

import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabase/client';

export default function TestClientProvider({ children }: { children: React.ReactNode }) {
  return <SessionContextProvider supabaseClient={supabase}>{children}</SessionContextProvider>;
}
