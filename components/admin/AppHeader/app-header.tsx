'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSafeAuth } from '@/hooks/useSafeAuth';
import { useRequestMeta } from '@/hooks/useRequestMeta';
import { AvatarMenu } from './avatar-menu';
import clsx from 'clsx';
import { supabase } from '@/lib/supabase/client';
import { useSafeScroll } from '@/hooks/useSafeScroll';
import { useSafeTargetRef } from '@/lib/ui/safeTargetRef';

// client-only to avoid SSR/CSR randomness
const InspirationalQuote = dynamic(
  () => import('@/components/ui/inspirational-quote'),
  { ssr: false }
);

const AUTH_CACHE_KEY = 'qs:auth:header:v1';
const AUTH_TTL_MS = 5 * 60_000;

type CachedAuth = {
  isLoggedIn: boolean;
  email?: string | null;
  role?: string | null;
  t: number;
};

const safeLS = {
  get<T = any>(k: string): T | null {
    try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
  },
  set(k: string, v: any) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  remove(k: string) { try { localStorage.removeItem(k); } catch {} },
};

export default function AppHeader(
  { collapsed = false, onToggleCollapsed }: { collapsed?: boolean; onToggleCollapsed?: (c: boolean) => void } = {}
) {
  const router = useRouter();
  const { user, role, isLoggedIn } = useSafeAuth();
  const { traceId, sessionId } = useRequestMeta();

  // ── Hydration guard: render a stable skeleton on first client pass
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => { setHydrated(true); }, []);

  // Start as "guest skeleton" to match SSR; upgrade in effects
  const [displayAuth, setDisplayAuth] = React.useState<{
    isLoggedIn: boolean;
    email?: string | null;
    role?: string | null;
    source: 'skeleton' | 'cache' | 'hook';
  }>({ isLoggedIn: false, email: undefined, role: undefined, source: 'skeleton' });

  // 1) Fast client-only cache hydrate (runs after mount → no SSR mismatch)
  React.useEffect(() => {
    const cached = safeLS.get<CachedAuth>(AUTH_CACHE_KEY);
    if (cached && Date.now() - cached.t < AUTH_TTL_MS) {
      setDisplayAuth({
        isLoggedIn: cached.isLoggedIn,
        email: cached.email ?? undefined,
        role: cached.role ?? undefined,
        source: 'cache',
      });
    }
  }, []);

  // 2) Authoritative hook → update + cache
  React.useEffect(() => {
    const nextIsLogged = !!isLoggedIn && !!user;
    const nextEmail = user?.email ?? undefined;
    const nextRole = (role as string | undefined) ?? undefined;

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

  // Cross-tab auth sync
  React.useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!session) {
        safeLS.remove(AUTH_CACHE_KEY);
        setDisplayAuth({ isLoggedIn: false, email: undefined, role: undefined, source: 'hook' });
        return;
      }
      const email = session.user?.email ?? undefined;
      setDisplayAuth(prev => {
        const next = { ...prev, isLoggedIn: true, email, source: 'hook' as const };
        safeLS.set(AUTH_CACHE_KEY, {
          isLoggedIn: next.isLoggedIn, email: next.email ?? null, role: next.role ?? null, t: Date.now(),
        } as CachedAuth);
        return next;
      });
    });
    return () => { sub.data.subscription.unsubscribe(); };
  }, []);

  // ── Safe scroll target (no early ref binding)
  const headerRef = React.useRef<HTMLElement | null>(null);
  const safeHeaderRef = useSafeTargetRef(headerRef); // undefined until mounted
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _scroll = useSafeScroll({ target: safeHeaderRef as any, offset: ['start start', 'end start'] as any });

  const [condensed, setCondensed] = React.useState(false);
  const [faded, setFaded] = React.useState(false);
  const quoteTags = React.useMemo(() => ['small-business', 'seo', 'persistence'] as const, []);

  // Condense on scroll
  React.useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-fade after idle
  React.useEffect(() => {
    let t: number | null = null;
    const arm = (ms = 1000) => { if (t) window.clearTimeout(t); t = window.setTimeout(() => setFaded(true), ms); };
    const wake = () => { if (t) window.clearTimeout(t); setFaded(false); arm(1000); };
    setFaded(false); arm(1000);
    const pc = { passive: true as const, capture: true as const };
    const onKey = (e: KeyboardEvent) => { if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key)) wake(); };
    window.addEventListener('scroll', wake, pc); window.addEventListener('wheel', wake, pc); window.addEventListener('touchmove', wake, pc);
    window.addEventListener('keydown', onKey, true);
    const el = headerRef.current; const onEnter = () => { if (t) window.clearTimeout(t); setFaded(false); }; const onLeave = () => arm(1200);
    el?.addEventListener('mouseenter', onEnter); el?.addEventListener('mouseleave', onLeave);
    return () => { if (t) window.clearTimeout(t);
      window.removeEventListener('scroll', wake, pc as any); window.removeEventListener('wheel', wake, pc as any); window.removeEventListener('touchmove', wake, pc as any);
      window.removeEventListener('keydown', onKey, true); el?.removeEventListener('mouseenter', onEnter); el?.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug('[🧭 AppHeader Role Info]', {
      email: user?.email, role, traceId, sessionId,
      displayFrom: displayAuth.source, displayEmail: displayAuth.email, displayRole: displayAuth.role,
    });
  }, [user?.email, role, traceId, sessionId, displayAuth.source, displayAuth.email, displayAuth.role]);

  const guest = !displayAuth.isLoggedIn;

  return (
    <header
      ref={headerRef}
      className={clsx(
        'fixed top-0 left-0 right-0 z-50',
        'px-2 py-[6px] min-h-[48px] border-b',
        guest ? 'bg-gray-900 text-zinc-300 border-zinc-800' : 'bg-gray-800 text-white border-zinc-700',
        condensed && 'backdrop-blur-md',
        'transition-opacity duration-500',
        faded ? 'opacity-25 hover:opacity-100' : 'opacity-100'
      )}
    >
      {/* Stable skeleton on first SSR/CSR pass: same markup either way */}
      {!hydrated ? (
        <div className="max-w-screen-lg mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span>QuickSites</span>
            <div className="text-xs text-cyan-300 max-w-xs" />
          </div>
          <a href="/login" className="text-blue-400 hover:underline">Log In</a>
        </div>
      ) : guest ? (
        <div className="max-w-screen-lg mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span>QuickSites</span>
            <div className="text-xs text-cyan-300 max-w-xs" suppressHydrationWarning>
              <InspirationalQuote tags={quoteTags} />
            </div>
          </div>
          <a href="/login" className="text-blue-400 hover:underline">Log In</a>
        </div>
      ) : (
        <div className="flex justify-between items-center max-w-screen-xl mx-auto relative">
          <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap max-w-full flex-1">
            <div className="text-xs text-cyan-300 max-w-xs" suppressHydrationWarning>
              <InspirationalQuote tags={quoteTags} />
            </div>
          </div>
          <div className="ml-2 flex items-center gap-2">
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
