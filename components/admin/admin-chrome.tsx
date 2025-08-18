// components/admin/admin-chrome.tsx
'use client';

import * as React from 'react';
import AppHeader from './AppHeader/app-header';
import ResponsiveAdminLayout from './responsive-admin-layout';

const SIDEBAR_EXPANDED = 288; // px (w-72)
const SIDEBAR_COLLAPSED = 56; // px (w-14)
const LS_KEY = 'admin-sidebar-collapsed';

export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  // read preference + viewport
  React.useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();

    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored != null) setCollapsed(stored === 'true');
      else if (window.innerWidth < 768) setCollapsed(true);
    } catch {}

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // “E” toggles sidebar (ignore while typing)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'e' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      setCollapsed((c) => {
        const next = !c;
        try { localStorage.setItem(LS_KEY, String(next)); } catch {}
        return next;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // keep a CSS var so any page can read the current sidebar width
  React.useEffect(() => {
    const w = isMobile ? 0 : (collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED);
    document.documentElement.style.setProperty('--qs-sidebar-w', `${w}px`);
  }, [collapsed, isMobile]);

  return (
    <>
      {/* Fixed sidebar (handles its own z-index/positioning) */}
      <ResponsiveAdminLayout
        collapsed={collapsed}
        onToggle={(c) => {
          setCollapsed(c);
          try { localStorage.setItem(LS_KEY, String(c)); } catch {}
        }}
      />

      {/* App frame: header + scrollable content */}
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        {/* The ONLY scroll container for pages */}
        <div
          className="qs-content-scroll relative"
          // left gutter for the fixed sidebar on desktop
          style={{ paddingLeft: isMobile ? 0 : `var(--qs-sidebar-w, ${SIDEBAR_EXPANDED}px)` }}
        >
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </>
  );
}
