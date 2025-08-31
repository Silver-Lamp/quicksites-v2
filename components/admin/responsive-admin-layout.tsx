'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { AdminNavSections } from '@/components/admin/AppHeader/AdminNavSections';

const STORAGE_KEY = 'admin-sidebar-collapsed';

/* ---------- resilient storage helpers ---------- */
const safeStorage = {
  get(key: string): string | null {
    try {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    } catch (e) {
      // Firefox private mode or blocked storage
      console.warn('[sidebar] localStorage.getItem failed:', e);
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
    } catch (e) {
      // QuotaExceededError or disabled storage
      console.warn('[sidebar] localStorage.setItem failed:', e);
    }
  },
};

export default function ResponsiveAdminLayout({
  onToggle,
  collapsed,
}: {
  onToggle?: (collapsed: boolean) => void;
  collapsed?: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed || false);
  const [isMobile, setIsMobile] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Init from storage + viewport
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);

    const stored = safeStorage.get(STORAGE_KEY);
    const initial = stored === 'true' || window.innerWidth < 768;
    setIsCollapsed(initial);

    return () => window.removeEventListener('resize', update);
  }, []);

  // Persist + notify (debounced)
  useEffect(() => {
    // debounce to avoid rapid writes
    const t = setTimeout(() => {
      safeStorage.set(STORAGE_KEY, String(isCollapsed));
      onToggle?.(isCollapsed);
      try {
        window.dispatchEvent(
          new CustomEvent('qs:sidebar:changed', { detail: isCollapsed })
        );
      } catch {} // no-op if CustomEvent blocked
    }, 50);

    return () => clearTimeout(t);
  }, [isCollapsed, onToggle]);

  // Programmatic control from toolbar/fullscreen
  useEffect(() => {
    const onSet = (e: Event) => {
      const val = (e as CustomEvent<boolean>).detail;
      if (typeof val === 'boolean') setIsCollapsed(val);
    };
    window.addEventListener('qs:sidebar:set-collapsed' as any, onSet as EventListener);
    return () =>
      window.removeEventListener('qs:sidebar:set-collapsed' as any, onSet as EventListener);
  }, []);

  // Hotkey: "e" toggles sidebar (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (t as any)?.isContentEditable) return;
      if (e.key?.toLowerCase() === 'e') {
        e.preventDefault();
        setIsCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Swipe close (mobile)
  useEffect(() => {
    const handleTouchStart = (ev: TouchEvent) => (touchStartX.current = ev.touches[0].clientX);
    const handleTouchEnd = (ev: TouchEvent) => {
      if (touchStartX.current === null) return;
      const deltaX = ev.changedTouches[0].clientX - touchStartX.current;
      if (deltaX < -50 && !isCollapsed) setIsCollapsed(true);
      touchStartX.current = null;
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart as any);
      window.removeEventListener('touchend', handleTouchEnd as any);
    };
  }, [isCollapsed]);

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobile && !isCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black z-30"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      <motion.aside
        animate={{ width: isCollapsed ? 56 : 288 }} // Tailwind: w-14 vs w-72
        transition={{ type: 'spring', stiffness: 250, damping: 30 }}
        className={clsx(
          'sticky top-0 left-0 z-40 h-screen bg-zinc-900 border-r border-zinc-800 text-white overflow-y-auto flex flex-col group'
        )}
      >
        <div className="relative">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 m-2 hover:bg-zinc-800 rounded transition relative"
            title={isCollapsed ? 'Expand Sidebar (E)' : 'Collapse Sidebar (E)'}
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {isCollapsed && (
              <span className="absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-all z-20 shadow pointer-events-none">
                Expand Sidebar
              </span>
            )}
          </button>
        </div>

        <div className={clsx('flex-1', isCollapsed && 'overflow-hidden')}>
          <AdminNavSections collapsed={isCollapsed} />
        </div>
      </motion.aside>
    </>
  );
}
