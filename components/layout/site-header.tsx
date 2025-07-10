// components/layout/site-header.tsx
'use client';

import { useSafeAuth } from '@/hooks/useSafeAuth';
import SafeLink from '@/components/ui/safe-link';
import InspirationalQuote from '@/components/ui/inspirational-quote';
import UserInfoPanel from './user-info-panel';

export default function SiteHeader() {
  const { isLoggedIn, user, role } = useSafeAuth();

  return (
    <header className="bg-gray-800 text-white sticky top-0 z-50 px-2 py-[6px] shadow-sm border-b border-zinc-700 min-h-[48px] transition-transform duration-300">
      <div className="flex justify-between items-center max-w-screen-xl mx-auto relative">
        <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap max-w-full flex-1">
          <SafeLink href="/" className="text-blue-400 hover:underline">
            <img src="/logo_v1.png" alt="QuickSites" className="h-12 w-auto" />
          </SafeLink>

          <div className="text-xs text-cyan-300 max-w-xs">
            <InspirationalQuote tags={['small-business', 'seo', 'persistence']} />
          </div>
        </div>

        <UserInfoPanel isLoggedIn={isLoggedIn} user={user} role={role} />
      </div>
    </header>
  );
}
