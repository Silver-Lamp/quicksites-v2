'use client';

import { NAV_SECTIONS } from '@/lib/nav/links';
import { useSession } from '@/hooks/useSession';
import { useState, useEffect } from 'react';

export function CommandPalette() {
  const { user } = useSession();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(NAV_SECTIONS.flatMap((s) => s.routes));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const lower = query.toLowerCase();
    const filtered = NAV_SECTIONS.flatMap((section) =>
      !section.role || user?.role === section.role
        ? section.routes.filter(
            (item) =>
              item.label.toLowerCase().includes(lower) || item.href.toLowerCase().includes(lower)
          )
        : []
    );
    setResults(filtered);
  }, [query, user, setResults]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur">
          <div className="max-w-xl mx-auto mt-24 bg-white dark:bg-zinc-900 rounded shadow-lg p-6 space-y-4">
            <input
              autoFocus
              type="text"
              placeholder="Type a page name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-4 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white"
            />
            <ul className="max-h-80 overflow-y-auto space-y-1">
              {results.map((item) => (
                <li key={item.href}>
                  <button
                    className="w-full text-left px-3 py-2 rounded hover:bg-blue-100 dark:hover:bg-zinc-700 text-sm"
                    onClick={() => {
                      window.location.href = item.href;
                      // ✅ Event log
                      fetch('/api/log-event', {
                        method: 'POST',
                        body: JSON.stringify({ type: 'nav_click', href: item.href }),
                      });
                    }}
                  >
                    {item.label} <span className="text-zinc-400 text-xs ml-2">{item.href}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="text-zinc-400 text-sm px-3 py-2">No matches</li>
              )}
            </ul>
            <p className="text-xs text-zinc-500 text-right">Press Esc to close</p>
          </div>
        </div>
      )}
    </>
  );
}
