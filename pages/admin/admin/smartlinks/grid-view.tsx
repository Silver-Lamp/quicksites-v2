import SmartLinkGrid from '@/components/admin/SmartLinkGrid';
import SmartLinkGallery from '@/components/admin/SmartLinkGallery';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartLinkProvider } from '@/components/admin/SmartLinkProvider';
import { mockSmartLinks } from '@/admin/mocks/mockSmartLinks';
import type { SmartLinkItem } from '@/admin/types/SmartLinkItem';
import { useRouter } from 'next/router';

export default function SmartLinkGridPage() {
  const items: SmartLinkItem[] = mockSmartLinks;
  const router = useRouter();
  const sort = router.query.sort as string;
  const view = (router.query.view as string) || 'grid';

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
              onClick={() => router.push({ query: { ...router.query, sort: 'type' } })}
            >
              Sort by Type
            </button>
            <button
              className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
              onClick={() => router.push({ query: { ...router.query, sort: 'theme' } })}
            >
              Sort by Theme
            </button>
          </div>
        <div className="flex gap-2 flex-wrap">
            {['template', 'snapshot'].map(tag => (
              <button
                key={tag}
                className={`text-xs px-3 py-1 rounded border border-zinc-600 hover:bg-zinc-700 ${router.query.tag === tag ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}
                onClick={() => router.push({ query: { ...router.query, tag } })}
              >
                {tag}
              </button>
            ))}
          <button
              className={`text-xs px-3 py-1 rounded border ${view === 'grid' ? 'bg-blue-700 text-white' : 'bg-zinc-800 text-zinc-300'} border-zinc-600`}
              onClick={() => router.push({ query: { ...router.query, view: 'grid' } })}
            >
              Grid
            </button>
            <button
              className={`text-xs px-3 py-1 rounded border ${view === 'gallery' ? 'bg-blue-700 text-white' : 'bg-zinc-800 text-zinc-300'} border-zinc-600`}
              onClick={() => router.push({ query: { ...router.query, view: 'gallery' } })}
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
          $1
          </motion.div>
        </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
          $1
          </motion.div>
        )}
      </AnimatePresence>
        )}
      </main>
    </SmartLinkProvider>
  );
}

