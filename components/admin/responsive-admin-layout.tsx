'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { AdminNavSections } from '@/components/admin/AppHeader/AdminNavSections';

export default function AdminSidebar({
  onToggle,
}: {
  onToggle?: (collapsed: boolean) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Detect mobile
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Load from storage
  useEffect(() => {
    const stored = localStorage.getItem('admin-sidebar-collapsed');
    if (stored === 'true' || window.innerWidth < 768) setIsCollapsed(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', String(isCollapsed));
    onToggle?.(isCollapsed);
  }, [isCollapsed, onToggle]);

  // Swipe close (mobile)
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      if (deltaX < -50 && !isCollapsed) setIsCollapsed(true);
      touchStartX.current = null;
    };
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isCollapsed]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCollapsed) setIsCollapsed(true);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
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

      {/* Sidebar container */}
      <motion.aside
        animate={{ width: isCollapsed ? 56 : 288 }} // Tailwind w-14 vs w-72
        transition={{ type: 'spring', stiffness: 250, damping: 30 }}
        className={clsx(
          'fixed top-0 left-0 z-40 h-screen bg-zinc-900 border-r border-zinc-800 text-white overflow-y-auto flex flex-col group'
        )}
      >
        <div className="relative">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 m-2 hover:bg-zinc-800 rounded transition relative"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {isCollapsed && (
              <span className="absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-all z-20 shadow pointer-events-none">
                Expand Sidebar
              </span>
            )}
          </button>

          {isCollapsed && (
            <div className="absolute top-0 right-0 w-2 h-full bg-transparent group-hover:bg-zinc-700 rounded-r cursor-pointer transition-all duration-200" />
          )}
        </div>

        <div className={clsx('flex-1', isCollapsed && 'overflow-hidden')}>
          <AdminNavSections collapsed={isCollapsed} />
        </div>
      </motion.aside>
    </>
  );
}
