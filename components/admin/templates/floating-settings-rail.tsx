// components/admin/templates/floating-settings-rail.tsx
'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { Settings2, ChevronLeft, ChevronRight } from 'lucide-react';

type Section = {
  id: string;
  title: string;
  onOpen: () => void; // open the section/panel you already have
  icon?: React.ReactNode;
};

type Props = {
  sections: Section[];
  className?: string;
  defaultOpen?: boolean;
  storageKey?: string;
};

export default function FloatingSettingsRail({
  sections,
  className,
  defaultOpen = true,
  storageKey = 'qs:settingsRailOpen',
}: Props) {
  const [open, setOpen] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultOpen;
    const saved = window.localStorage.getItem(storageKey);
    return saved ? saved === '1' : defaultOpen;
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, open ? '1' : '0');
    }
  }, [open, storageKey]);

  // Hotkey: "s" toggles rail (not when typing in input/textarea)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* Gear button (visible when collapsed) */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="gear"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            onClick={() => setOpen(true)}
            className="fixed left-4 top-20 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-zinc-100 shadow-lg ring-1 ring-white/10 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
            aria-label="Open settings (S)"
            title="Open settings (S)"
          >
            <Settings2 className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Rail */}
      <motion.aside
        aria-label="Settings"
        className={cn(
          'fixed left-0 top-16 bottom-4 z-40',
          'flex flex-col overflow-hidden rounded-r-xl border border-white/10 bg-zinc-950/90 backdrop-blur',
          'shadow-2xl',
          className
        )}
        initial={false}
        animate={{ width: open ? 280 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 32 }}
      >
        {/* Inner content only mounts when open to avoid tabbable ghosts */}
        <AnimatePresence mode="popLayout">
          {open && (
            <motion.div
              key="rail-body"
              className="flex h-full w-[280px] flex-col"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Settings2 className="h-4 w-4 text-purple-400" />
                  Settings
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  aria-label="Collapse settings (S)"
                  title="Collapse settings (S)"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Hide
                </button>
              </div>

              <div className="space-y-2 overflow-auto px-3 pb-3">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={s.onOpen}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <span className="flex items-center gap-2">
                      {s.icon}
                      <span>{s.title}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 opacity-60" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </>
  );
}
