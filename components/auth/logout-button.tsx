'use client';

import { useLoginStatus } from '@/hooks/useLoginStatus';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LogoutButton() {
  const { user } = useLoginStatus();
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.push('/login');
    setTimeout(() => window.location.reload(), 500);
  };

  useEffect(() => {
    if (user) {
      console.log('[👤 Logged in as]', user.email);
    }
  }, [user]);

  if (!user) return null;

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-red-500 underline text-xs mt-2"
    >
      {loading ? 'Logging out...' : 'Log out'}
    </button>
  );
}
