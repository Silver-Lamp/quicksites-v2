'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import SafeLink from '../../ui/safe-link';
import { useSafeAuth } from '@/hooks/useSafeAuth';
import { useRequestMeta } from '@/hooks/useRequestMeta';
import InspirationalQuote from '@/components/ui/inspirational-quote';
import { AvatarMenu } from './avatar-menu';
import clsx from 'clsx';
import { supabase } from '@/lib/supabase/client'; // ← for auth state events

// ---------- local cache helpers ----------
const AUTH_CACHE_KEY = 'qs:auth:header:v1';
const AUTH_TTL_MS = 5 * 60_000; // 5 minutes

const safeLS = {
  get<T = any>(k: string): T | null {
    try {
      const raw = localStorage.getItem(k);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: any) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      // ignore QuotaExceededError/private mode
      // console.warn('[AppHeader] localStorage.set failed:', e);
    }
  },
  remove(k: string) {
    try { localStorage.removeItem(k); } catch {}
  },
};

type CachedAuth = {
  isLoggedIn: boolean;
  email?: string | null;
  role?: string | null;
  t: number; // timestamp
};

export default function AppHeader(
  { collapsed = false, onToggleCollapsed }: { collapsed?: boolean, onToggleCollapsed?: (collapsed: boolean) => void } = {}
) {
  const router = useRouter();
  const { user, role, isLoggedIn } = useSafeAuth();          // authoritative (may arrive async)
  const { traceId, sessionId } = useRequestMeta();

  // ---------- display auth derived from cache first, then hook ----------
  const [displayAuth, setDisplayAuth] = React.useState<{
    isLoggedIn: boolean;
    email?: string | null;
    role?: string | null;
    source: 'cache' | 'hook';
  }>(() => {
    if (typeof window === 'undefined') return { isLoggedIn: false, email: undefined, role: undefined, source: 'cache' };
    const cached = safeLS.get<CachedAuth>(AUTH_CACHE_KEY);
    if (cached && Date.now() - cached.t < AUTH_TTL_MS) {
      return {
        isLoggedIn: cached.isLoggedIn,
        email: cached.email ?? undefined,
        role: cached.role ?? undefined,
        source: 'cache',
      };
    }
    // default until hook resolves
    return { isLoggedIn: false, email: undefined, role: undefined, source: 'cache' };
  });

  // When the hook resolves/changes, update display + cache (no flicker thereafter)
  React.useEffect(() => {
    const nextIsLogged = !!isLoggedIn && !!user;
    const nextEmail = user?.email ?? undefined;
    const nextRole = (role as string | undefined) ?? undefined;

    // Only update when something actually changed to avoid thrash
    if (
      displayAuth.isLoggedIn !== nextIsLogged ||
      displayAuth.email !== nextEmail ||
      displayAuth.role !== nextRole ||
      displayAuth.source !== 'hook'
    ) {
      setDisplayAuth({ isLoggedIn: nextIsLogged, email: nextEmail, role: nextRole, source: 'hook' });
      safeLS.set(AUTH_CACHE_KEY, {
        isLoggedIn: nextIsLogged,
        email: nextEmail ?? null,
        role: nextRole ?? null,
        t: Date.now(),
      } as CachedAuth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, user?.email, role]);

  // Keep cache in sync with sign-in/out events across tabs
  React.useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!session) {
        // signed out
        safeLS.remove(AUTH_CACHE_KEY);
        setDisplayAuth({ isLoggedIn: false, email: undefined, role: undefined, source: 'hook' });
        return;
      }

      // signed in → optimistic update from session (email), role will hydrate from hook/cache
      const email = session.user?.email ?? undefined;
      setDisplayAuth(prev => {
        const next = { ...prev, isLoggedIn: true, email, source: 'hook' as const };
        safeLS.set(AUTH_CACHE_KEY, {
          isLoggedIn: next.isLoggedIn,
          email: next.email ?? null,
          role: next.role ?? null, // <-- safe: uses the updated state
          t: Date.now(),
        } as CachedAuth);
        return next;
      });
    });

    return () => { sub.data.subscription.unsubscribe(); };
  }, []);


  const ref = React.useRef<HTMLElement | null>(null);
  const [condensed, setCondensed] = React.useState(false);
  const [faded, setFaded] = React.useState(false);
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
    const onScroll = () => setCondensed(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-fade header after 1s idle; any scroll/touch/wheel/scroll-key wakes it
  React.useEffect(() => {
    let t: number | null = null;
    const arm = (ms = 1000) => { if (t) window.clearTimeout(t); t = window.setTimeout(() => setFaded(true), ms); };
    const wake = () => { if (t) window.clearTimeout(t); setFaded(false); arm(1000); };
    setFaded(false); arm(1000);

    const passiveCapture = { passive: true as const, capture: true as const };
    const onKey = (e: KeyboardEvent) => {
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
      displayFrom: displayAuth.source, displayEmail: displayAuth.email, displayRole: displayAuth.role,
    });
  }, [user?.email, role, traceId, sessionId, displayAuth.source, displayAuth.email, displayAuth.role]);

  const guest = !displayAuth.isLoggedIn;

  return (
    <header
      ref={ref}
      className={clsx(
        'fixed top-0 left-0 right-0 z-50',
        'px-2 py-[6px] min-h-[48px] border-b',
        guest ? 'bg-gray-900 text-zinc-300 border-zinc-800'
              : 'bg-gray-800 text-white border-zinc-700',
        condensed && 'backdrop-blur-md',
        'transition-opacity duration-500',
        faded ? 'opacity-25 hover:opacity-100' : 'opacity-100'
      )}
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
            <div className="text-xs text-cyan-300 max-w-xs">
              <InspirationalQuote tags={quoteTags} />
            </div>
          </div>

          <div className="ml-2 flex items-center gap-2">
            {/* AvatarMenu likely reads the same auth context; it can render a quick skeleton internally if needed */}
            <AvatarMenu />
            <div className="leading-tight">
              <div>{displayAuth.email ?? user?.email ?? ''}</div>
              <div className="text-zinc-400 text-xs">role: {displayAuth.role ?? (role as string) ?? 'user'}</div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
