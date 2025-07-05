// components/admin/AppHeader/mobile-drawer.tsx
'use client';

import SafeLink from '../../ui/safe-link';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { disableBodyScroll, enableBodyScroll } from 'body-scroll-lock';

export function MobileDrawer({
  drawerOpen,
  onClose,
}: {
  drawerOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const drawer = document.getElementById('mobile-drawer');
    if (drawerOpen && drawer) {
      disableBodyScroll(drawer);
    } else {
      enableBodyScroll(drawer || document.body);
    }
    return () => enableBodyScroll(drawer || document.body);
  }, [drawerOpen]);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[98]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Drawer */}
          <motion.div
            id="mobile-drawer"
            className="fixed top-0 left-0 w-64 h-full bg-zinc-900 text-white z-[99] p-4 shadow-2xl sm:hidden overflow-y-auto"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
          >
            <h2 className="text-lg font-bold mb-4">Menu</h2>
            <nav className="space-y-4 text-sm">
              <details open>
                <summary className="cursor-pointer font-semibold text-blue-300">Core</summary>
                <div className="ml-4 flex flex-col gap-1">
                  <SafeLink href="/admin">Dashboard</SafeLink>
                  <SafeLink href="/admin/the-grid">Map of Opportunites</SafeLink>
                  <SafeLink href="/admin/leads">Leads</SafeLink>
                  <SafeLink href="/admin/campaigns">Campaigns</SafeLink>
                  <SafeLink href="/admin/start-campaign">Start Campaign</SafeLink>
                </div>
              </details>
              <details>
                <summary className="cursor-pointer font-semibold text-green-300">Logs & Analytics</summary>
                <div className="ml-4 flex flex-col gap-1">
                  <SafeLink href="/admin/logs">Logs</SafeLink>
                  <SafeLink href="/admin/logs/sessions">Session Logs</SafeLink>
                  <SafeLink href="/admin/analytics">Analytics</SafeLink>
                  <SafeLink href="/admin/heatmap">Heatmap</SafeLink>
                </div>
              </details>
              <details>
                <summary className="cursor-pointer font-semibold text-yellow-300">Templates</summary>
                <div className="ml-4 flex flex-col gap-1">
                  <SafeLink href="/admin/templates">All Templates</SafeLink>
                  <SafeLink href="/admin/templates-new">+ New Template</SafeLink>
                </div>
              </details>
              <details>
                <summary className="cursor-pointer font-semibold text-purple-300">Dev Tools</summary>
                <div className="ml-4 flex flex-col gap-1">
                  <SafeLink href="/admin/docs">Docs</SafeLink>
                  <SafeLink href="/admin/query-usecases">Params</SafeLink>
                  <SafeLink href="/admin/branding/og-editor/xyz">OG Editor</SafeLink>
                </div>
              </details>
              <details>
                <summary className="cursor-pointer font-semibold text-red-300">Admin</summary>
                <div className="ml-4 flex flex-col gap-1">
                  <SafeLink href="/admin/users">Users</SafeLink>
                  <SafeLink href="/admin/roles">Roles</SafeLink>
                </div>
              </details>
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
