// components/admin/AppHeader/app-header.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SafeLink from '../../ui/safe-link';
import { MobileDrawer } from './mobile-drawer';
import { NavSections } from './nav-sections';
import { useSafeAuth } from '@/hooks/useSafeAuth';
import UserMenu from '@/components/auth/user-menu';
import { useRequestMeta } from '@/hooks/useRequestMeta';

export default function AppHeader() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, role, isLoggedIn } = useSafeAuth();
  const { traceId, sessionId } = useRequestMeta();

  useEffect(() => {
    console.debug('[🧭 AppHeader Role Info]', {
      email: user?.email,
      role,
      traceId,
      sessionId,
    });
  }, [user?.email, role, traceId, sessionId]);

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
      <header className="bg-gray-800 text-white border-b border-gray-700 sticky top-0 z-50 px-4 py-3">
        <div className="flex justify-between items-center max-w-screen-xl mx-auto relative">
          <div className="flex items-center overflow-x-auto whitespace-nowrap max-w-full flex-1">
            <SafeLink href="/" className="text-blue-400 hover:underline">
              <img src="/logo.png" alt="QuickSites" width={100} height={100} />
            </SafeLink>
            <NavSections />
          </div>
          <div className="ml-4">
            <UserMenu />
          </div>

          {/* 🐞 Small debug tag */}
          {(traceId || sessionId) && (
            <div
              className="absolute -bottom-5 right-2 text-[10px] text-zinc-500 font-mono"
              title={`Trace ID: ${traceId}\nSession ID: ${sessionId}`}
            >
              trace: <span className="text-cyan-400">{traceId?.slice(0, 6) || '---'}</span> | session:{' '}
              <span className="text-amber-400">{sessionId?.slice(0, 6) || '---'}</span>
            </div>
          )}
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
