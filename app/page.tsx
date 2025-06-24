import { redirect } from 'next/navigation';
import { getSupabase } from '@/lib/supabase/universal';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export default async function Home() {
  const supabase = await getSupabase();
  const cookieStore = cookies(); // This is sync
  console.log('🍪 [Home] Incoming cookies:', cookieStore); // removed .getAll()

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.warn('⚠️ [Home] Supabase session error:', sessionError);
  }

  const user = session?.user;
  console.log('🔒 [Home] Supabase session user:', user);

  if (!user) {
    console.log('🔒 [Home] No session user — rendering public page');
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Welcome to QuickSites</h1>
        </div>
      </div>
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    console.warn('⚠️ [Home] Failed to fetch user profile:', profileError.message);
  } else {
    console.log('🔒 [Home] User profile:', profile);
  }

  const role = profile?.role ?? 'viewer';
  console.log('🔒 [Home] Final role check:', role);

  if (['admin', 'owner', 'reseller'].includes(role)) {
    console.log(`➡️ [Home] Redirecting to /admin/dashboard for role: ${role}`);
    redirect('/admin/dashboard');
  }

  if (role === 'viewer') {
    console.log(`➡️ [Home] Redirecting to /viewer`);
    redirect('/viewer');
  }

  console.log(`🚫 [Home] No role match — redirecting to unauthorized`);
  redirect('/unauthorized');
}
