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
    try {
      const stored = localStorage.getItem('admin-sidebar-collapsed');
      if (stored === 'true') setIsCollapsed(true);
    } catch {
      /* noop */
    }
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem('admin-sidebar-collapsed', String(isCollapsed));
    } catch {
      /* noop */
    }
  }, [isCollapsed]);

  // Keyboard shortcut: press "e" to toggle
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || el.isContentEditable) return true;
      // Also skip if focused inside a code editor (monaco/ace/codemirror etc.)
      const editorish = el.closest('.cm-editor, .monaco-editor, .ace_editor');
      return Boolean(editorish);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Only plain "e" (no modifiers), and not while typing
      if (e.key.toLowerCase() !== 'e') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isTypingTarget(document.activeElement)) return;

      e.preventDefault();
      setIsCollapsed((c) => !c);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
          title={isCollapsed ? 'Expand Sidebar (E)' : 'Collapse Sidebar (E)'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
