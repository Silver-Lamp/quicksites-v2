'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { createClient } from '@supabase/supabase-js';
import { GripVertical } from 'lucide-react';
import RenderBlock from '@/components/admin/templates/RenderBlock';
import BlockSidebar from '@/components/admin/templates/BlockSidebar';
import { SortableBlockList } from '@/components/admin/templates/SortableBlockList';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
const SiteSettingsPanel = dynamic(() => import('@/components/admin/SiteSettingsPanel'), { ssr: false });
import ModalWrapper from '@/components/ui/ModalWrapper'; 
import type { SiteData } from '@/types/site';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EditPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);
  
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/sites/${slug}`) // TODO: add error handling for 404 and 500 errors
      .then(res => res.json())
      .then(data => {
        console.debug('[EditPage] useEffect triggered', data);
        setSiteData(data);
      })
      .catch(err => {
        console.error('Site load failed:', err);
        alert('Failed to load site');
      });
  }, [slug]);

  useEffect(() => {
    console.debug('[EditPage] useEffect triggered', siteData, slug);
    if (!siteData) {
      console.debug('[EditPage] siteData is null', siteData, slug);
      return;
    }
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      if (!siteData?._meta?.id) return;
      await fetch('/api/sites/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: siteData._meta.id, data: siteData }),
      });
      console.log('Saving site to UUID:', siteData?._meta?.id);

      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 800);
  }, [siteData]);

  const handleSlugChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextSlug = e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    setSiteData({ ...siteData, slug: nextSlug });
  };

  const handleTogglePublish = () => {
    setSiteData({ ...siteData, is_published: !siteData.is_published });
  };

  const currentPage = siteData?.pages?.[currentPageIndex];
  const blocksWithId = currentPage?.content_blocks?.map((b: any, i: number) => ({
    _id: b._id || `block-${i}-${Date.now()}`,
    ...b,
  })) || [];

  const handleBlockSave = (updatedBlock: any) => {
    const pages = [...siteData.pages];
    pages[currentPageIndex].content_blocks[selectedBlockIndex!] = updatedBlock;
    setSiteData({ ...siteData, pages });
    setSelectedBlockIndex(null);
  };

  const handleAddBlock = (type: string) => {
    const newBlock = {
      _id: `block-${Date.now()}`,
      type,
      content: { headline: 'New Block', subheadline: '', cta_text: '', cta_link: '' },
    };
    const pages = [...siteData.pages];
    pages[currentPageIndex].content_blocks.push(newBlock);
    setSiteData({ ...siteData, pages });
    setShowBlockPicker(false);
  };

  console.debug('[EditPage] siteData:', JSON.stringify(siteData));
  return (
    <div className="text-white p-6 max-w-screen-xl mx-auto relative">
      <div className="flex justify-between items-center mb-4">
        <div>
          <input
            type="text"
            value={siteData?.slug || ''}
            onChange={handleSlugChange}
            className="text-2xl font-bold bg-transparent border-b border-zinc-600 focus:outline-none px-2 py-1"
            placeholder="custom-slug"
          />
          <span className="ml-2 text-sm text-zinc-400">
            {siteData?.is_published ? '🌐 Live' : '📝 Draft'}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!siteData?.is_published}
              onChange={handleTogglePublish}
              className="accent-blue-500"
            />
            Publish
          </label>

          {siteData?.slug && (
            <a
              href={`https://${siteData.slug}.quicksites.ai`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 text-sm hover:underline"
            >
              🔗 View Site
            </a>
          )}

          <button
            onClick={() => setShowSettings(true)}
            className="text-sm text-blue-400 hover:underline"
          >
            🛠 Site Settings
          </button>
        </div>
      </div>

      {saved && (
        <div className="absolute top-4 right-6 text-green-400 text-sm bg-zinc-800 px-3 py-1 rounded shadow">
          ✅ Saved
        </div>
      )}

      {isHydrated && showSettings && siteData?._meta?.id && (
        <ModalWrapper open={showSettings} onClose={() => setShowSettings(false)} title="Site Settings">
          <div className="h-full p-6">
            <SiteSettingsPanel siteId={siteData._meta.id} />
          </div>
        </ModalWrapper>
      )}

      {!siteData ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="flex justify-between mb-4">
            <label className="text-sm text-zinc-400">Page:</label>
            <select
              value={currentPageIndex}
              onChange={e => setCurrentPageIndex(Number(e.target.value))}
              className="bg-zinc-800 p-2 rounded ml-2"
            >
              {siteData.pages.map((p: any, i: number) => (
                <option key={p.id} value={i}>
                  {p.slug || `Page ${i + 1}`}
                </option>
              ))}
            </select>
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="text-sm text-blue-400 hover:underline"
            >
              {previewMode ? '🔧 Edit Mode' : '👁️ Preview Mode'}
            </button>
          </div>

          {previewMode ? (
            <DndContext collisionDetection={closestCenter}>
              <SortableContext
                items={siteData.pages.map((p: any) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {siteData.pages.map((page: any, pageIndex: number) => (
                    <div key={page.id} className="mb-8 bg-zinc-800 rounded p-4 shadow">
                      <div className="flex items-center gap-2 text-zinc-300 mb-4">
                        <GripVertical className="w-4 h-4 opacity-60" />
                        <h2 className="text-lg font-semibold">📄 {page.slug || `Page ${pageIndex + 1}`}</h2>
                      </div>
                      {page.content_blocks.map((block: any, i: number) => (
                        <div key={i} className="mb-4">
                          <RenderBlock block={block} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <>
              <SortableBlockList
                blocks={blocksWithId}
                onChange={(next) => {
                  const pages = [...siteData.pages];
                  pages[currentPageIndex].content_blocks = next;
                  setSiteData({ ...siteData, pages });
                }}
                onDelete={(blockId: string) => {
                  const pages = [...siteData.pages];
                  pages[currentPageIndex].content_blocks = pages[currentPageIndex].content_blocks.filter(
                      (b: { _id: string }) => b._id !== blockId
                  );
                  setSiteData({ ...siteData, pages });
                }}
                onEdit={(blockId: string) => {
                  const index = blocksWithId.findIndex((b: { _id: string }) => b._id === blockId);
                  if (index !== -1) setSelectedBlockIndex(index);
                }}
              />
              <button
                className="mt-4 px-3 py-2 text-sm bg-blue-700 rounded hover:bg-blue-800"
                onClick={() => setShowBlockPicker(true)}
              >
                ➕ Add Block
              </button>

              {showBlockPicker && (
                <div className="mt-4 p-4 border border-zinc-700 rounded bg-zinc-800">
                  <h3 className="text-sm font-semibold mb-2">Choose a block type</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {["hero", "services", "testimonial", "text", "cta", "quote"].map((type) => (
                      <button
                        key={type}
                        onClick={() => handleAddBlock(type)}
                        className="text-left p-2 rounded bg-zinc-700 hover:bg-zinc-600"
                      >
                        <span className="block font-medium capitalize">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {selectedBlockIndex !== null && (
            <BlockSidebar
              block={siteData.pages[currentPageIndex].content_blocks[selectedBlockIndex]}
              onChange={(updated) => handleBlockSave(updated)}
              onClose={() => setSelectedBlockIndex(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
