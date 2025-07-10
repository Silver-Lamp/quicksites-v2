'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { AdminNavSections } from '@/components/admin/AppHeader/AdminNavSections';

export default function AdminSidebar() {
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

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  return (
    <aside
      className={clsx(
        'group bg-zinc-900 text-white border-r border-zinc-800 h-screen sticky top-0 overflow-y-auto flex flex-col transition-all duration-300 max-w-full',
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
            <span className="absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-all z-20">
              Expand Sidebar
            </span>
          )}
        </button>
      </div>

      <div className={clsx('flex-1', isCollapsed && 'overflow-hidden')}>
        <AdminNavSections collapsed={isCollapsed} />
      </div>
    </aside>
  );
}
