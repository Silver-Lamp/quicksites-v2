'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import SafeLink from '../../ui/safe-link';
import { AvatarMenu } from './avatar-menu';
import { MobileDrawer } from './mobile-drawer';
import { NavSections } from './nav-sections';

export default function AppHeader() {
  const { user, role, roleSource, ready } = useCurrentUser();
  const router = useRouter();
  const email = user?.email;
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    console.debug('[🧭 AppHeader Role Info]', {
      email,
      role,
      source: roleSource,
    });
  }, [email, role, roleSource]);

  const logout = async () => {
    try {
      const { supabase } = await import('@/admin/lib/supabaseClient');
      await supabase.auth.signOut();
      if (email) localStorage.removeItem(`cached-role-${email}`);
      router.replace('/login');
      setTimeout(() => window.location.reload(), 200);
    } catch (err) {
      console.error('❌ Logout failed', err);
      alert('Logout error. Please try again.');
    }
  };

  if (!ready) {
    return (
      <header className="bg-zinc-900 border-b border-zinc-800 h-14 flex items-center px-4">
        <div className="w-32 h-6 bg-zinc-700 rounded animate-pulse" />
      </header>
    );
  }

  return (
    <>
      <header className="flex justify-between items-center px-4 py-2 border-b border-zinc-700 relative z-50">
        <div className="bg-gray-800 text-white border-b border-gray-700 px-4 py-3 sticky top-0 z-50">
          <div className="flex justify-between items-center">
            <div className="overflow-x-auto whitespace-nowrap max-w-full flex-1">
              <SafeLink href="/" className="text-blue-400 hover:underline">
                <img src="/logo.png" alt="QuickSites" width={100} height={100} />
              </SafeLink>
              {user && <NavSections />}
            </div>
            {user ? (
              <div className="flex items-center space-x-4 ml-4">
                <AvatarMenu
                  email={email}
                  avatarUrl={user?.avatar_url || ''}
                  role={role || ''}
                  source={roleSource}
                  onLogout={logout}
                />
              </div>
            ) : (
              <div className="ml-4 text-xs text-gray-500">
                <SafeLink href="/login" className="text-blue-400 hover:underline">
                  Sign In
                </SafeLink>
              </div>
            )}
          </div>
        </div>
      </header>

      {user && (
        <>
          {/* Mobile Nav Toggle */}
          <button
            className="absolute top-2 left-2 z-50 bg-zinc-800 text-white px-2 py-1 rounded shadow sm:hidden"
            onClick={() => setDrawerOpen(!drawerOpen)}
          >
            {drawerOpen ? '✕' : '☰'}
          </button>
          <MobileDrawer drawerOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </>
      )}
    </>
  );
}
