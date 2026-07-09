import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseRSC } from '@/lib/supabase/serverClient';
import AdminChrome from '@/components/admin/admin-chrome';

// Wrap the profile in the standard admin chrome (sidebar + header + work-surface
// background) so it's consistent with the rest of the app instead of hand-rolling
// a header + nav in the page.
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent('/profile')}`);
  return <AdminChrome>{children}</AdminChrome>;
}
