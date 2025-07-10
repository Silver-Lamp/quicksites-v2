'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SafeLink from '../../ui/safe-link';
import { useSafeAuth } from '@/hooks/useSafeAuth';
import UserMenu from '@/components/auth/user-menu';
import { useRequestMeta } from '@/hooks/useRequestMeta';
// import { AdminNavSections } from './AdminNavSections';
import InspirationalQuote from '@/components/ui/inspirational-quote';
import { AvatarMenu } from './avatar-menu';

export default function AppHeader() {
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;
    const header = document.querySelector('header');
    let hideTimeout: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      if (!header) return;

      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 48) {
        if (!header.classList.contains('translate-y-[-100%]')) {
          header.classList.add('translate-y-[-100%]', 'transition-transform', 'duration-300');
        }
      } else {
        header.classList.remove('translate-y-[-100%]');
      }

      if (currentScrollY > 10) {
        header.classList.add('opacity-90', 'backdrop-blur-md');
      } else {
        header.classList.remove('opacity-90', 'backdrop-blur-md');
      }

      lastScrollY = currentScrollY;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    });

    header?.addEventListener('mouseenter', () => {
      if (header.classList.contains('translate-y-[-100%]')) {
        header.classList.remove('translate-y-[-100%]');
      }
      if (hideTimeout) clearTimeout(hideTimeout);
    });

    header?.addEventListener('mouseleave', () => {
      hideTimeout = setTimeout(() => {
        if (window.scrollY > 48) {
          header.classList.add('translate-y-[-100%]');
        }
      }, 1200);
    });


return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
      <header className="px-4 py-2 text-zinc-400 text-sm shadow-sm border-b border-zinc-800">
  <div className="max-w-screen-lg mx-auto flex justify-between items-center">
    <div className="flex items-center gap-4">
      <span>QuickSites</span>
      <div className="text-xs text-cyan-300 max-w-xs">
       <InspirationalQuote tags={["small-business", "seo", "persistence"]} />
      </div>
    </div>
    <a href="/login" className="text-blue-400 hover:underline">
      Log In
    </a>
  </div>
</header>
    );
  }

  return (
    <header className="bg-gray-800 text-white sticky top-0 z-50 px-2 py-[6px] shadow-sm border-b border-zinc-700 min-h-[48px] transition-transform duration-300">
      <div className="flex justify-between items-center max-w-screen-xl mx-auto relative">
        <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap max-w-full flex-1">
          <SafeLink href="/" className="text-blue-400 hover:underline">
            <img src="/logo_v1.png" alt="QuickSites" className="h-12 w-auto" />
          </SafeLink>
  
          {/* ✅ Always show inspirational quote */}
          <div className="text-xs text-cyan-300 max-w-xs">
            <InspirationalQuote tags={['small-business', 'seo', 'persistence']} />
          </div>
        </div>
  
        <div className="ml-2 flex items-center gap-2">
          {isLoggedIn && user ? (
            <div className="flex items-center gap-2">
              <AvatarMenu />
              <div>
                <div>{user.email}</div>
                <div className="text-zinc-500">role: {role}</div>
              </div>
            </div>
          ) : (
            <a href="/login" className="text-blue-400 hover:underline">
              Log In
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
