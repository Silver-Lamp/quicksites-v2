'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Sparkles, Trash2, CheckCircle } from 'lucide-react';
import { suggestFix } from '@/lib/roastbot/suggestFix';
import { useBlockFix } from '@/components/ui/block-fix-context';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { Block } from '@/types/blocks';

type BlockMeta = {
  id: string;
  type: string;
  el: HTMLElement;
};

type FeedbackMode = 'roast' | 'truth';
type RoastLevel = 'mild' | 'medium' | 'scorched';

export default function SquatBotPanel() {
  const [blocks, setBlocks] = useState<BlockMeta[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<'blocks' | 'roasts'>('blocks');
  const [roastLevel, setRoastLevel] = useState<RoastLevel>('medium');
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('roast');
  const [roasts, setRoasts] = useState<Record<string, string>>({});
  const router = useRouter();

  const {
    draftFixes,
    committedFixes,
    setDraftFix,
    discardFix,
    commitFix,
    toggle: toggleFixPreview,
    enabled: previewingFixes,
    resetAll,
  } = useBlockFix();

  const loadBlocks = () => {
    const elements = Array.from(document.querySelectorAll('[data-block-id]')) as HTMLElement[];
    const metas: BlockMeta[] = elements.map((el) => ({
      id: el.dataset.blockId || '',
      type: el.dataset.blockType || 'unknown',
      el,
    }));
    setBlocks(metas);
    console.log(`🦾 SquatBot loaded ${metas.length} blocks`);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'i') setVisible((v) => !v);
      if (e.key.toLowerCase() === 'r' && visible) {
        console.log('🔁 Refreshing SquatBot block list...');
        loadBlocks();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setTimeout(() => {
      loadBlocks();
    }, 50);
  }, [visible]);

  useEffect(() => {
    blocks.forEach((block) => {
      block.el.style.outline =
        block.id === highlightedId
          ? '2px solid #9333ea'
          : draftFixes[block.id]
          ? '2px dashed #16a34a'
          : '';
    });
  }, [highlightedId, blocks, draftFixes]);

  const saveFixes = async () => {
    const slug = window.location.pathname.split('/')[2];
    const res = await fetch(`/api/fix-template?slug=${slug}`, {
      method: 'POST',
      body: JSON.stringify({ fixes: committedFixes }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      toast.success('✅ Fixes saved to Supabase!');
      router.refresh();
    } else {
      toast.error('❌ Failed to save fixes');
    }
  };

  return (
    <>
      <button
        onClick={() => setVisible((v) => !v)}
        className="fixed bottom-4 right-4 z-50 bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700 transition-all"
        aria-label="Toggle SquatBot"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      {visible && (
        <div className="fixed bottom-4 left-4 z-50 w-[360px] max-h-[65vh] overflow-y-auto bg-neutral-900 text-white rounded-lg shadow-xl border border-white/10 text-sm">
          <div className="p-3 border-b border-white/10 flex justify-between items-center">
            <span className="font-semibold">🦾 SquatBot Dev Panel</span>
            <div className="flex gap-2 text-xs">
              <button
                className={clsx('px-2 py-1 rounded', tab === 'blocks' && 'bg-white text-black')}
                onClick={() => setTab('blocks')}
              >
                Blocks
              </button>
              <button
                className={clsx('px-2 py-1 rounded', tab === 'roasts' && 'bg-white text-black')}
                onClick={() => setTab('roasts')}
              >
                RoastBot
              </button>
            </div>
          </div>

          {tab === 'blocks' && (
            <>
              <div className="p-3 border-b border-white/10 flex justify-between text-xs">
                <span>Preview Fixes</span>
                <button
                  onClick={toggleFixPreview}
                  className={clsx(
                    'px-2 py-1 rounded font-mono',
                    previewingFixes ? 'bg-green-600 text-white' : 'bg-white text-black'
                  )}
                >
                  {previewingFixes ? 'ON' : 'OFF'}
                </button>
              </div>

              {Object.keys(draftFixes).length > 0 && (
                <div className="px-3 py-2 flex justify-between text-xs border-b border-white/10">
                  <button
                    onClick={resetAll}
                    className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                  >
                    🧹 Reset All
                  </button>
                </div>
              )}
            </>
          )}

          <div className="divide-y divide-white/5 px-2">
            {blocks.map((block) => {
              const draft = draftFixes[block.id];
              const committed = committedFixes[block.id];
              const hasFix = draft && Object.keys(draft).length > 0;

              return (
                <div
                  key={block.id}
                  className={clsx(
                    'px-2 py-2 transition group',
                    highlightedId === block.id && 'bg-purple-800/30'
                  )}
                  onMouseEnter={() => setHighlightedId(block.id)}
                  onMouseLeave={() => setHighlightedId(null)}
                >
                  <div className="flex justify-between items-center">
                    <div className="text-white font-mono text-xs flex items-center gap-2">
                      {block.type} <code>{block.id}</code>
                      {committed && <span className="text-green-400">✅</span>}
                      {!committed && draft && <span className="text-yellow-400">🟡</span>}
                    </div>

                    <div className="flex gap-1">
                      {!hasFix && (
                        <button
                          onClick={() => {
                            const el = block.el;
                            if (!el) return;
                            const content = (el as any).__squatterContent || {};
                            const patch = suggestFix({ type: block.type, content } as Block);
                            (el as any).__squatterContent = { ...content, ...patch };
                            setDraftFix(block.id, patch);
                            toast.success(`🛠 Fix preview applied`);
                          }}
                          className="text-xs bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700"
                        >
                          Fix it
                        </button>
                      )}

                      {hasFix && (
                        <button
                          onClick={() => discardFix(block.id)}
                          className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Undo
                        </button>
                      )}

                      {hasFix && !committed && (
                        <button
                          onClick={() => {
                            commitFix(block.id);
                            toast.success('✅ Fix committed');
                          }}
                          className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" /> Commit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {Object.keys(committedFixes).length > 0 && (
            <div className="p-3 border-t border-white/10 text-center">
              <button
                onClick={saveFixes}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-semibold"
              >
                💾 Save Fixes to Supabase
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
