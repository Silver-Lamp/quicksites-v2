// ---- app/page.tsx ----
import { redirect } from 'next/navigation';
import { getServerUserProfile } from '@/lib/supabase/getServerUserProfile';

export const runtime = 'nodejs';

export default async function Home() {
  const profile = await getServerUserProfile();

  if (profile?.role && ['admin', 'owner', 'reseller'].includes(profile.role)) {
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