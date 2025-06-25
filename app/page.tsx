export const runtime = 'nodejs';         // optional, for SSR-safe access
export const dynamic = 'force-dynamic';  // ✅ key fix

import { getUserFromRequest } from '@/lib/supabase/server';

export default async function Home() {
  const { user, supabase } = await getUserFromRequest();

  if (!user) {
    console.log('🔓 [Home] No session — rendering public home');
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
  }

  const role = profile?.role ?? 'viewer';
  console.log('🔐 [Home] User role:', role);

//   if (['admin', 'owner', 'reseller'].includes(role)) {
//     console.log('➡️ [Home] Redirecting to /admin/dashboard');
//     redirect('/admin/dashboard');
//   }

//   if (role === 'viewer') {
//     console.log('➡️ [Home] Redirecting to /viewer');
//     redirect('/viewer');
//   }

//   console.log('🚫 [Home] Unknown role — redirecting to /unauthorized');
//   redirect('/unauthorized');
}
