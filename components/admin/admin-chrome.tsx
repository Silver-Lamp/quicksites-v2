// components/admin/admin-chrome.tsx
'use client';

import * as React from 'react';
import AppHeader from './AppHeader/app-header';
import ResponsiveAdminLayout from './responsive-admin-layout';
import { useSafeScroll } from '@/hooks/useSafeScroll';
import { useSafeTargetRef } from '@/lib/ui/safeTargetRef';

const DESKTOP_BP = 1024; // lg

export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  // Sync viewport + saved sidebar state
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < DESKTOP_BP);
    onResize();
    window.addEventListener('resize', onResize);

    try {
      const stored = localStorage.getItem('admin-sidebar-collapsed');
      if (stored != null) setCollapsed(stored === 'true');
      else if (window.innerWidth < DESKTOP_BP) setCollapsed(true);
    } catch {/* no-op */}

    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Kill any global fixed-header spacer set earlier
  React.useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.getPropertyValue('--app-header-h');
    root.style.setProperty('--app-header-h', '0px');
    return () => {
      if (prev) root.style.setProperty('--app-header-h', prev);
      else root.style.removeProperty('--app-header-h');
    };
  }, []);

  /* ───────── safe scroll wiring (hydration-proof) ───────── */
  const headerRef = React.useRef<HTMLElement | null>(null);
  const safeHeaderRef = useSafeTargetRef(headerRef); // ← undefined until hydrated

  // Even if you don't use the values, calling this is safe; it no-ops until ref exists
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _scroll = useSafeScroll({
    target: safeHeaderRef as any,          // can be undefined on first client render
    offset: ['start start', 'end start'] as any,
  });

  return (
    <div data-admin-root className="min-h-screen bg-background text-foreground">
      <div className="relative flex">
        <ResponsiveAdminLayout
          collapsed={collapsed}
          onToggle={(next: boolean) => {
            setCollapsed(next);
            try { localStorage.setItem('admin-sidebar-collapsed', String(next)); } catch {}
          }}
        />

        {/* Content column — NOTE: no padding-left */}
        <div className="min-w-0 flex-1">
          <header
            ref={headerRef}
            className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          >
            <AppHeader
              collapsed={collapsed}
              onToggleCollapsed={(next: boolean) => {
                setCollapsed(next);
                try { localStorage.setItem('admin-sidebar-collapsed', String(next)); } catch {}
              }}
            />
          </header>

          <main className="min-w-0 pt-0">{children}</main>
        </div>
      </div>

      {/* Hard reset for any legacy paddings */}
      <style jsx global>{`
        [data-admin-root] .content-scroll,
        [data-admin-root] .gs-content-scroll,
        [data-admin-root] main {
          padding-top: 0 !important;
          margin-top: 0 !important;
          padding-left: 0 !important;
          margin-left: 0 !important;
        }
        [data-admin-root] #app-header-spacer { display: none !important; }
      `}</style>
    </div>
  );
}
