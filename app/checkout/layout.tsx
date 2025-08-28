import type { ReactNode } from 'react';
// import { redirect } from 'next/navigation';
// import { getSupabaseRSC } from '@/lib/supabase/serverClient';
import AdminChrome from '@/components/admin/admin-chrome';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // const supabase = await getSupabaseRSC();              // ✅ RSC-safe
  // const { data: { user } } = await supabase.auth.getUser();
  // if (!user) redirect(`/login?next=${encodeURIComponent('/admin/templates/list')}`);
  return <AdminChrome>{children}</AdminChrome>;
}
