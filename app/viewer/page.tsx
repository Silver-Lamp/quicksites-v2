'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAutoRedirectByRole } from '@/hooks/useAutoRedirectByRole';
import { useSafeAuth } from '@/hooks/useSafeAuth';
import { NavSections } from '@/components/admin/AppHeader/nav-sections';
import UserMenu from '@/components/auth/user-menu';

export default function ViewerHomeRedirect() {
  const [cancelled, setCancelled] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const router = useRouter();
  const { user, role, isLoggedIn } = useSafeAuth();

  useAutoRedirectByRole({
    roleRoutes: {
      viewer: '/viewer/dashboard',
      admin: '/admin/dashboard',
      owner: '/admin/dashboard',
      reseller: '/admin/dashboard',
    },
    fallbackRoute: '/unauthorized',
    enableTestBypass: true,
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname.includes('quicksites.ai')) {
      if (isLoggedIn && user) setShowNav(true);
    }

    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.warn('[🕒 Timeout] Redirect did not resolve in time');
        router.replace('/login?timeout=true');
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [cancelled, isLoggedIn, user, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-4" />
      <p className="text-sm text-gray-400 mb-2">Redirecting based on your role...</p>
      <p className="text-xs text-gray-500 mb-4">
        Host: {typeof window !== 'undefined' ? window.location.hostname : '...'}
      </p>

      {showNav && (
        <div className="animate-fade-in transition-opacity duration-700 ease-in opacity-100">
          <NavSections />
        </div>
      )}

      {/* {isLoggedIn && user && (
        <div className="animate-fade-in transition-opacity duration-700 ease-in mt-4 opacity-100">
          <UserMenu />
        </div>
      )} */}

      <button
        className="text-xs text-red-400 underline mt-6"
        onClick={() => setCancelled(true)}
      >
        Cancel and go back
      </button>
    </div>
  );
}
