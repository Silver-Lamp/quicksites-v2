// app/page.tsx
import { redirect } from 'next/navigation';
import { getSupabase } from '@/lib/supabase/universal';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export default async function Home() {
  const supabase = await getSupabase();

  const cookieStore = await cookies();
  console.log('🍪 All incoming cookies', cookieStore.getAll());

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const role = session?.user?.user_metadata?.role;

  console.log('🔒 [App Index] Supabase session', { session });
  console.log('🔒 [App Index] User role (metadata)', { role });

  if (role && ['admin', 'owner', 'reseller'].includes(role)) {
    redirect('/admin/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-white bg-black">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Welcome to QuickSites</h1>
      </div>
    </div>
  );
}
