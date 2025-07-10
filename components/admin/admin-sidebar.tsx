'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { AdminNavSections } from '@/components/admin/AppHeader/AdminNavSections';

export default function AdminSidebar({
  onToggle,
}: {
  onToggle?: (collapsed: boolean) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load stored collapsed state and auto-collapse if screen is small
  useEffect(() => {
    const stored = localStorage.getItem('admin-sidebar-collapsed');
    if (stored === 'true') setIsCollapsed(true);

    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persist collapsed state and notify parent
  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', String(isCollapsed));
    onToggle?.(isCollapsed);
  }, [isCollapsed, onToggle]);

  return (
    <aside
      className={clsx(
        'group fixed top-0 left-0 z-40 h-screen bg-zinc-900 border-r border-zinc-800 text-white overflow-y-auto transition-all duration-300 flex flex-col',
        isCollapsed ? 'w-14 group-hover:w-72' : 'w-72'
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

        {/* Optional handle zone for hover rescue */}
        {isCollapsed && (
          <div className="absolute top-0 right-0 w-2 h-full bg-transparent group-hover:bg-zinc-700 rounded-r cursor-pointer transition-all duration-200" />
        )}
      </div>

      <div className={clsx('flex-1', isCollapsed && 'overflow-hidden')}>
        <h1>hello</h1>
        <AdminNavSections collapsed={isCollapsed} />
      </div>
    </aside>
  );
}
