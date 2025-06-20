'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

export default function MobileDrawerSidebar() {
  const [open, setOpen] = useState(false);
  const touchStartX = useRef(0);

  const routes = [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Sites', href: '/admin/sites' },
    { label: 'Logs', href: '/admin/logs' },
    { label: 'Sitemap Diffs', href: '/docs/diffs', badge: '🆕' },
  ];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - touchStartX.current;
    if (diff > 60) setOpen(true);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-30 md:hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      />

      <button
        className="md:hidden p-2 rounded text-white bg-zinc-800 fixed top-4 left-4 z-50"
        onClick={() => setOpen(true)}
      >
        <Menu className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.2 }}
            className="fixed inset-y-0 left-0 w-64 bg-zinc-900 text-white shadow-lg z-40 p-4 space-y-4"
          >
            <button className="absolute top-4 right-4 text-zinc-400" onClick={() => setOpen(false)}>
              <X className="w-5 h-5" />
            </button>

            <nav className="mt-8 flex flex-col space-y-2">
              {routes.map(({ label, href, badge }) => (
                <Link
                  key={href}
                  href={href}
                  className="px-4 py-2 rounded hover:bg-zinc-700 text-sm font-medium flex items-center justify-between"
                  onClick={() => setOpen(false)}
                >
                  <span>{label}</span>
                  {badge && <span className="ml-2 text-yellow-400 text-xs">{badge}</span>}
                </Link>
              ))}
            </nav>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
