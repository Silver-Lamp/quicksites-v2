// app/admin/AppHeader/avatar-menu.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Loader2, UserCircle, Settings, User } from 'lucide-react';
import md5 from 'blueimp-md5';

import { RoleBadge } from './role-badge';
import { useSafeAuth } from '@/hooks/useSafeAuth';
import { supabase } from '@/lib/supabase/client';

/* ---------- cache helpers ---------- */
const AUTH_CACHE_KEY = 'qs:auth:header:v1';
const AUTH_TTL_MS = 5 * 60_000;

type CachedAuth = {
  isLoggedIn: boolean;
  email?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  t: number;
};

const safeLS = {
  get<T = any>(k: string): T | null {
    try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) as T : null; }
    catch { return null; }
  },
  set(k: string, v: any) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  remove(k: string) { try { localStorage.removeItem(k); } catch {} },
};

export function AvatarMenu() {
  const { user, role, isLoggedIn } = useSafeAuth(); // may resolve async
  const router = useRouter();

  // UI state
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // cache-first display state (prevents “Log In → avatar” flip)
  const [display, setDisplay] = useState<{
    isLoggedIn: boolean;
    email?: string | null;
    role?: string | null;
    avatar_url?: string | null;
    source: 'cache' | 'hook';
  }>(() => {
    if (typeof window === 'undefined') {
      return { isLoggedIn: false, email: undefined, role: undefined, avatar_url: undefined, source: 'cache' };
    }
    const cached = safeLS.get<CachedAuth>(AUTH_CACHE_KEY);
    if (cached && Date.now() - cached.t < AUTH_TTL_MS) return { ...cached, source: 'cache' };
    return { isLoggedIn: false, email: undefined, role: undefined, avatar_url: undefined, source: 'cache' };
  });

  // Sync display with hook (and write cache)
  useEffect(() => {
    const next = {
      isLoggedIn: !!isLoggedIn && !!user,
      email: user?.email ?? null,
      role: (role as string | undefined) ?? null,
      avatar_url: (user as any)?.avatar_url ?? null,
      source: 'hook' as const,
    };
    if (
      display.isLoggedIn !== next.isLoggedIn ||
      display.email !== next.email ||
      display.role !== next.role ||
      display.avatar_url !== next.avatar_url ||
      display.source !== 'hook'
    ) {
      setDisplay(next);
      safeLS.set(AUTH_CACHE_KEY, { ...next, t: Date.now() } as CachedAuth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, user?.email, (user as any)?.avatar_url, role]);

  // Cross-tab / instant auth updates
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!session) {
        safeLS.remove(AUTH_CACHE_KEY);
        setDisplay({ isLoggedIn: false, email: null, role: null, avatar_url: null, source: 'hook' });
      } else {
        const email = session.user?.email ?? null;
        setDisplay(prev => {
          const next = { ...prev, isLoggedIn: true, email, source: 'hook' as const };
          safeLS.set(AUTH_CACHE_KEY, { ...next, t: Date.now() } as CachedAuth);
          return next;
        });
      }
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  // Click outside to close (HOOK ALWAYS BEFORE ANY RETURNS)
  useEffect(() => {
    if (!open || !display.isLoggedIn) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, display.isLoggedIn]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      safeLS.remove(AUTH_CACHE_KEY); // clear cached auth
      router.push('/login?logout=1');
      setTimeout(() => window.location.reload(), 300);
    } finally {
      setLoggingOut(false);
    }
  };

  // Now safe to early-return (no hooks after this line)
  if (!display.isLoggedIn) return null;

  const email = display.email ?? user?.email ?? '';
  const roleStr = (display.role ?? role) || 'user';
  const isAdmin = ['admin', 'owner', 'reseller'].includes(roleStr);

  const avatarUrl =
    display.avatar_url ||
    (user as any)?.avatar_url ||
    `https://gravatar.com/avatar/${md5(email.trim().toLowerCase())}?d=identicon`;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="focus:outline-none"
        aria-label="Avatar menu"
      >
        <div className="w-6 h-6 sm:w-5 sm:h-5 rounded-full overflow-hidden border border-white">
          <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-700 rounded shadow-xl text-xs z-50 p-3 space-y-3"
          >
            <div className="flex items-center gap-2 text-gray-300">
              <UserCircle size={14} />
              <span className="truncate">{email}</span>
            </div>

            <RoleBadge role={roleStr} />

            <div className="border-t border-zinc-700 pt-2 space-y-2">
              <button
                onClick={() => router.push('/profile')}
                className="flex items-center gap-2 hover:underline text-left text-gray-300 w-full"
              >
                <User size={14} />
                My Profile
              </button>

              {isAdmin && (
                <button
                  onClick={() => router.push('/admin/settings')}
                  className="flex items-center gap-2 hover:underline text-left text-gray-300 w-full"
                >
                <Settings size={14} />
                Admin Settings
              </button>
              )}
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className={`flex items-center gap-2 text-red-400 hover:underline text-left w-full ${loggingOut ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loggingOut ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Logging out...
                </>
              ) : (
                <>
                  <LogOut size={14} />
                  Log Out
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
