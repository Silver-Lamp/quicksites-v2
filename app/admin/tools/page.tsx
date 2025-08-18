// app/admin/tools/page.tsx
// SERVER ONLY — no "use client"

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import { AdminToolsPage } from '@/components/admin/tools/AdminToolsPage';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies(); // Read-only in RSC

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // ✅ RSC-friendly adapter (read-only)
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin/tools')}`);
  }

  return <AdminToolsPage />;
}
