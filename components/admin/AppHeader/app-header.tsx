'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import SafeLink from '../../ui/safe-link';
import { useSafeAuth } from '@/hooks/useSafeAuth';
import { useRequestMeta } from '@/hooks/useRequestMeta';
import InspirationalQuote from '@/components/ui/inspirational-quote';
import { AvatarMenu } from './avatar-menu';
import clsx from 'clsx';
import { useAutoFadeOnScrollIdle } from '../hooks/useAutoFadeOnScrollIdle';

export default function AppHeader(
  { collapsed = false, onToggleCollapsed }: { collapsed?: boolean, onToggleCollapsed?: (collapsed: boolean) => void } = {}
) {
  const router = useRouter();
  const { user, role, isLoggedIn } = useSafeAuth();
  const { traceId, sessionId } = useRequestMeta();

  const ref = React.useRef<HTMLElement | null>(null);

  const [condensed, setCondensed] = React.useState(false);
  const [faded, setFaded] = React.useState(false);     // ⬅️ auto-fade state
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

  // Condense on scroll (but do not hide)
  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setCondensed(y > 10);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-fade header after 2s of idle; any scroll/touch/wheel/scroll-key wakes it
  React.useEffect(() => {
    let t: number | null = null;

    const arm = (ms = 1000) => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => setFaded(true), ms);
    };

    const wake = () => {
      if (t) window.clearTimeout(t);
      setFaded(false);
      arm(1000);
    };

    // show fully on mount for a moment, then arm
    setFaded(false);
    arm(1000);

    const passiveCapture = { passive: true as const, capture: true as const };
    const onKey = (e: KeyboardEvent) => {
      // keys that imply scrolling
      if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key)) wake();
    };

    window.addEventListener('scroll', wake, passiveCapture);
    window.addEventListener('wheel', wake, passiveCapture);
    window.addEventListener('touchmove', wake, passiveCapture);
    window.addEventListener('keydown', onKey, true);

    const el = ref.current;
    const onEnter = () => { if (t) window.clearTimeout(t); setFaded(false); };
    const onLeave = () => arm(1200);
    el?.addEventListener('mouseenter', onEnter);
    el?.addEventListener('mouseleave', onLeave);

    return () => {
      if (t) window.clearTimeout(t);
      window.removeEventListener('scroll', wake, passiveCapture as any);
      window.removeEventListener('wheel', wake, passiveCapture as any);
      window.removeEventListener('touchmove', wake, passiveCapture as any);
      window.removeEventListener('keydown', onKey, true);
      el?.removeEventListener('mouseenter', onEnter);
      el?.removeEventListener('mouseleave', onLeave);
    };
  }, []);

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
        condensed && 'backdrop-blur-md',
        // ⬇️ smooth opacity fade; hover always restores
        'transition-opacity duration-500',
        faded ? 'opacity-25 hover:opacity-100' : 'opacity-100'
      )}
      // header stays always-visible; pages can pad using --app-header-h
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
            {/* {collapsed ? (
              <div className="text-blue-400 hover:underline">
                <img src="/logo_v1.png" alt="QuickSites" className="h-8 w-auto" />
              </div>
            ) : (
              <SafeLink href="/" className="text-blue-400 hover:underline">
                <img src="/logo_v1.png" alt="QuickSites" className="h-8 w-auto" />
              </SafeLink>
            )} */}
            <div className="text-xs text-cyan-300 max-w-xs">
              <InspirationalQuote tags={quoteTags} />
            </div>
          </div>

          <div className="ml-2 flex items-center gap-2">
            <AvatarMenu />
            <div className="leading-tight">
              <div>{user.email}</div>
              <div className="text-zinc-400 text-xs">role: {role}</div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
