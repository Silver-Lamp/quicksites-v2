'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SafeLink from '../../ui/safe-link';
import { AvatarMenu } from './avatar-menu';
import { MobileDrawer } from './mobile-drawer';
import { NavSections } from './nav-sections';
import { useSafeAuth } from '@/hooks/useSafeAuth';

export default function AppHeader() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { user, role, isLoggedIn } = useSafeAuth();

  useEffect(() => {
    console.debug('[🧭 AppHeader Role Info]', {
      email: user?.email,
      role,
    });
  }, [user?.email, role]);

  const logout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      if (user?.email) {
        localStorage.removeItem(`cached-role-${user.email}`);
      }
      router.replace('/login?logout=1');
      setTimeout(() => window.location.reload(), 300);
    } catch (err) {
      console.error('❌ Logout failed', err);
      alert('Logout error. Please try again.');
    }
  };

  if (!isLoggedIn || !user) {
    return (
      <header className="px-4 py-2 border-b border-zinc-700 text-zinc-400 text-sm">
        <div className="max-w-screen-lg mx-auto flex justify-between items-center">
          <span>QuickSites</span>
          <a href="/login" className="text-blue-400 hover:underline">
            Log In
          </a>
        </div>
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
              <NavSections />
            </div>
            <div className="flex items-center space-x-4 ml-4">
              <AvatarMenu
                email={user.email}
                avatarUrl={user.avatar_url || ''}
                role={role}
                onLogout={logout}
              />
            </div>
          </div>
        </div>
      </header>

      <button
        className="absolute top-2 left-2 z-50 bg-zinc-800 text-white px-2 py-1 rounded shadow sm:hidden"
        onClick={() => setDrawerOpen(!drawerOpen)}
      >
        {drawerOpen ? '✕' : '☰'}
      </button>
      <MobileDrawer drawerOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
