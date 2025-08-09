// app/admin/layout.tsx
'use client';

import '@/styles/globals.css';
import AppHeader from '@/components/admin/AppHeader/app-header';
import { AdminNavSections } from '@/components/admin/AppHeader/AdminNavSections';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load persisted state
  useEffect(() => {
    const stored = localStorage.getItem('admin-sidebar-collapsed');
    if (stored === 'true') setIsCollapsed(true);
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <aside
        className={clsx(
          'group bg-zinc-900 text-white transition-all duration-300 border-r border-zinc-800 h-screen sticky top-0 overflow-y-auto flex flex-col',
          isCollapsed ? 'w-14' : 'w-64'
        )}
        onMouseEnter={() => {
          if (isCollapsed) document.body.classList.add('hover-sidebar');
        }}
        onMouseLeave={() => {
          if (isCollapsed) document.body.classList.remove('hover-sidebar');
        }}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-zinc-800 rounded transition m-2"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>

        <div className={clsx('flex-1', isCollapsed && 'overflow-hidden')}>
          <AdminNavSections collapsed={isCollapsed} />
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-h-screen">
        <AppHeader />
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
