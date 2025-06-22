'use client';

import { useRouter } from 'next/navigation.js';
import { useMemo, useState } from 'react';
import { parseISO, isAfter, isBefore } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import SmartLinkGrid from '@/components/admin/smart-link-grid';
import SmartLinkGallery from '@/components/admin/smart-link-gallery';
import { SmartLinkProvider } from '@/components/admin/smart-link-provider';
import { mockSmartLinks } from '@/tests/mocks/mocks/mockSmartLinks';
import type { SmartLinkItem } from '@/types/SmartLinkItem';

export default function SmartLinkGridPage() {
  const items: SmartLinkItem[] = mockSmartLinks;
  const router = useRouter();

  const searchParams = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const sort = searchParams.get('sort') || '';
  const view = searchParams.get('view') || 'grid';
  const tag = searchParams.get('tag') || '';

  const updateSearchParam = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    return `?${params.toString()}`;
  };

  const sorted = [...items].sort((a, b) => {
    if (sort === 'type') return a.type.localeCompare(b.type);
    if (sort === 'theme') return (a.theme || '').localeCompare(b.theme || '');
    return 0;
  });

  return (
    <SmartLinkProvider>
      <main className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <h1 className="text-xl font-bold text-white">🧱 SmartLink Grid View</h1>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
              onClick={() => router.push(updateSearchParam('sort', 'type'))}
            >
              Sort by Type
            </button>
            <button
              className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
              onClick={() => router.push(updateSearchParam('sort', 'theme'))}
            >
              Sort by Theme
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {['template', 'snapshot'].map((t) => (
              <button
                key={t}
                className={`text-xs px-3 py-1 rounded border border-zinc-600 hover:bg-zinc-700 ${
                  tag === t ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300'
                }`}
                onClick={() => router.push(updateSearchParam('tag', t))}
              >
                {t}
              </button>
            ))}
            <button
              className={`text-xs px-3 py-1 rounded border ${
                view === 'grid' ? 'bg-blue-700 text-white' : 'bg-zinc-800 text-zinc-300'
              } border-zinc-600`}
              onClick={() => router.push(updateSearchParam('view', 'grid'))}
            >
              Grid
            </button>
            <button
              className={`text-xs px-3 py-1 rounded border ${
                view === 'gallery' ? 'bg-blue-700 text-white' : 'bg-zinc-800 text-zinc-300'
              } border-zinc-600`}
              onClick={() => router.push(updateSearchParam('view', 'gallery'))}
            >
              Gallery
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {view === 'gallery' ? (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <SmartLinkGallery items={sorted} />
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <SmartLinkGrid items={sorted} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </SmartLinkProvider>
  );
}
