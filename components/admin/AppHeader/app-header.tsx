'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import SafeLink from '../../ui/safe-link';
import { useSafeAuth } from '@/hooks/useSafeAuth';
import { useRequestMeta } from '@/hooks/useRequestMeta';
import InspirationalQuote from '@/components/ui/inspirational-quote';
import { AvatarMenu } from './avatar-menu';
import clsx from 'clsx';

export default function AppHeader() {
  const router = useRouter();
  const { user, role, isLoggedIn } = useSafeAuth();
  const { traceId, sessionId } = useRequestMeta();

  const ref = React.useRef<HTMLElement | null>(null);
  const lastY = React.useRef(0);
  const hideTimer = React.useRef<number | null>(null);

  const [hidden, setHidden] = React.useState(false);
  const [condensed, setCondensed] = React.useState(false);
  const [h, setH] = React.useState(56);

  const quoteTags = React.useMemo(
    () => ['small-business', 'seo', 'persistence'] as const,
    []
  );

  // measure & expose height as a CSS var so the page can pad under the fixed header
  React.useEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const hh = Math.max(48, Math.round(el.getBoundingClientRect().height));
      setH(hh);
      document.documentElement.style.setProperty('--app-header-h', `${hh}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // scroll-driven hide/show (fixed header => no extra scroll space)
  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setCondensed(y > 10);

      const goingDown = y > lastY.current;
      setHidden(goingDown && y > h);

      lastY.current = y;
    };

    const el = ref.current;
    const onEnter = () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      setHidden(false);
    };
    const onLeave = () => {
      if (window.scrollY > h) {
        hideTimer.current = window.setTimeout(() => setHidden(true), 1200) as any;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    el?.addEventListener('mouseenter', onEnter);
    el?.addEventListener('mouseleave', onLeave);

    return () => {
      window.removeEventListener('scroll', onScroll);
      el?.removeEventListener('mouseenter', onEnter);
      el?.removeEventListener('mouseleave', onLeave);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [h]);

  React.useEffect(() => {
    // safe debug
    // eslint-disable-next-line no-console
    console.debug('[🧭 AppHeader Role Info]', {
      email: user?.email, role, traceId, sessionId,
    });
  }, [user?.email, role, traceId, sessionId]);

  const guest = !isLoggedIn || !user;

  return (
    <header
      ref={ref}
      className={clsx(
        'fixed top-0 left-0 right-0 z-50',
        'px-2 py-[6px] min-h-[48px] border-b',
        guest ? 'bg-gray-900 text-zinc-300 border-zinc-800'
              : 'bg-gray-800 text-white border-zinc-700',
        condensed && 'opacity-90 backdrop-blur-md',
        'transition-transform duration-300 will-change-transform'
      )}
      style={{ transform: hidden ? 'translateY(-100%)' : 'translateY(0)' }}
      // style={{ ['--app-header-h' as any]: `${h}px` }}
    >
      {guest ? (
        <div className="max-w-screen-lg mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span>QuickSites</span>
            <div className="text-xs text-cyan-300 max-w-xs">
              <InspirationalQuote tags={quoteTags} />
            </div>
          </div>
          <a href="/login" className="text-blue-400 hover:underline">Log In</a>
        </div>
      ) : (
        <div className="flex justify-between items-center max-w-screen-xl mx-auto relative">
          <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap max-w-full flex-1">
            <SafeLink href="/" className="text-blue-400 hover:underline">
              <img src="/logo_v1.png" alt="QuickSites" className="h-12 w-auto" />
            </SafeLink>
            <div className="text-xs text-cyan-300 max-w-xs">
              <InspirationalQuote tags={quoteTags} />
            </div>
          </div>

          <div className="ml-2 flex items-center gap-2">
            <AvatarMenu />
            <div>
              <div>{user.email}</div>
              <div className="text-zinc-400">role: {role}</div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
