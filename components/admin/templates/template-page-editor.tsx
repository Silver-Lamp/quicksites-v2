// components/admin/templates/template-page-editor.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { BlocksEditor } from './blocks-editor';
import { createDefaultPage } from '@/lib/pageDefaults';
import type { Template, TemplateData, Page } from '@/types/template';
import type { Block } from '@/types/blocks';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import { FloatingAddBlockHere } from '@/components/editor/floating-add-block-here';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor'; // ⬅️ NEW

export default function TemplatePageEditor({
  template,
  onChange,
  onLivePreviewUpdate,
  blockErrors = {},
}: {
  template: Template;
  onChange: (template: Template) => void;
  onLivePreviewUpdate: (data: TemplateData) => void;
  blockErrors: Record<string, BlockValidationError[]>;
}) {
  const [collapsedPages, setCollapsedPages] = useState<Record<string, boolean>>({});
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');
  const [showErrorBanner, setShowErrorBanner] = useState(true);

  // ⬇️ NEW: which block/page is in the editor
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [editingPageIndex, setEditingPageIndex] = useState<number | null>(null);

  const pages: Page[] = Array.isArray(template.data?.pages) ? template.data!.pages : [];

  useEffect(() => {
    const errorPages = pages.filter((page) =>
      (page.content_blocks || []).some((block) => block._id && blockErrors[block._id])
    );

    const expandedByDefault: Record<string, boolean> = {};
    for (const page of pages) {
      expandedByDefault[page.slug] = errorPages.some((ep) => ep.slug === page.slug);
    }
    setCollapsedPages(expandedByDefault);

    const firstBlockId = Object.keys(blockErrors)[0];
    if (firstBlockId) {
      document.getElementById(`block-${firstBlockId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }

    if (Object.keys(blockErrors).length > 0) {
      setShowErrorBanner(true);
    }
  }, [template.data?.pages, blockErrors]);

  // ——— helpers ———
  const commitPages = (nextPages: Page[]) => {
    const updated: Template = {
      ...template,
      data: { ...(template.data ?? {}), pages: nextPages },
    };
    onChange(updated);
    onLivePreviewUpdate(updated.data!);
  };

  const patchPageAt = (index: number, patch: Partial<Page>) => {
    const next = pages.map((p, i) => (i === index ? { ...p, ...patch } : p));
    commitPages(next);
  };

  const handleAddPage = () => {
    if (!newPageTitle || !newPageSlug) return;
    const newPage = createDefaultPage({ title: newPageTitle, slug: newPageSlug });
    commitPages([...pages, newPage]);
    setNewPageTitle('');
    setNewPageSlug('');
  };

  const handlePageBlockChange = (pageIndex: number, updatedBlocks: Block[]) => {
    patchPageAt(pageIndex, { content_blocks: [...updatedBlocks] });
  };

  // ⬇️ UPDATED: insert then immediately open editor
  const handleInsertBlockAt = (pageIndex: number, insertIndex: number, blockType: string) => {
    const newBlock = createDefaultBlock(blockType as any) as Block;
    const target = pages[pageIndex];
    if (!target) return;

    const newBlocks = [...(target.content_blocks || [])];
    newBlocks.splice(insertIndex, 0, newBlock);
    patchPageAt(pageIndex, { content_blocks: newBlocks });

    setEditingBlock(newBlock);
    setEditingPageIndex(pageIndex);
    // scroll it into view after paint
    setTimeout(() => {
      document.querySelector<HTMLElement>(
        `[data-block-id="${newBlock._id}"], #block-${newBlock._id}`
      )?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  };

  const scrollToFirstError = () => {
    const firstBlockId = Object.keys(blockErrors)[0];
    if (firstBlockId) {
      document.getElementById(`block-${firstBlockId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  const collapseCleanPages = () => {
    const collapsed: Record<string, boolean> = {};
    for (const page of pages) {
      const hasErrors = (page.content_blocks || []).some((b) => b._id && blockErrors[b._id]);
      collapsed[page.slug] = !hasErrors;
    }
    setCollapsedPages(collapsed);
  };

  return (
    <div className="space-y-6 border-gray-700 rounded p-4">
      {/* … existing banner, page loop, etc … */}

      {(pages || []).map((page, pageIndex) => {
        const contentBlocks = page.content_blocks || [];
        const errorCount =
          contentBlocks.filter((b) => b._id && blockErrors[b._id])?.length || 0;

        return (
          <div
            key={page.slug}
            className={`rounded p-4 space-y-4 ${
              errorCount > 0
                ? 'border border-red-500 bg-red-500/5'
                : 'border border-gray-700 bg-muted'
            }`}
          >
            {/* … page header … */}

            {!collapsedPages[page.slug] && (
              <>
                {contentBlocks.map((block, blockIndex) => (
                  <div key={block._id || blockIndex}>
                    <BlocksEditor
                      blocks={[
                        {
                          ...block,
                          meta: {
                            ...(block.meta || {}),
                            hasError: !!blockErrors[block._id ?? ''],
                            errorMessages: blockErrors[block._id ?? ''] || [],
                          },
                        },
                      ]}
                      onChange={(updated) => {
                        const updatedBlocks = [...contentBlocks];
                        updatedBlocks[blockIndex] = updated[0];
                        handlePageBlockChange(pageIndex, updatedBlocks);
                      }}
                      industry={template.industry}
                      onEdit={(b: Block) => {          // ⬅️ OPEN EDITOR FOR EXISTING BLOCKS
                        setEditingBlock(b);
                        setEditingPageIndex(pageIndex);
                      }}
                      onReplaceWithAI={() => {}}
                    />
                    <FloatingAddBlockHere
                      onAdd={(type) => handleInsertBlockAt(pageIndex, blockIndex + 1, type)}
                    />
                  </div>
                ))}

                {contentBlocks.length === 0 && (
                  <FloatingAddBlockHere onAdd={(type) => handleInsertBlockAt(pageIndex, 0, type)} />
                )}

                <BlockAdderGrouped
                  existingBlocks={contentBlocks}
                  onAdd={(type) => handleInsertBlockAt(pageIndex, contentBlocks.length, type)}
                />
              </>
            )}
          </div>
        );
      })}

      {/* … Add New Page … */}

      {/* ⬇️ NEW: overlay editor */}
      {editingBlock && (
        <div className="fixed inset-0 bg-black/90 z-[999] p-6 overflow-auto flex items-center justify-center">
          <div className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
            <DynamicBlockEditor
              block={editingBlock}
              onSave={(updatedBlock) => {
                const pageIdx =
                  editingPageIndex ??
                  pages.findIndex((p) =>
                    (p.content_blocks ?? []).some((b: any) => b._id === updatedBlock._id)
                  );
                if (pageIdx < 0) {
                  setEditingBlock(null);
                  return;
                }
                const updatedBlocks = (pages[pageIdx].content_blocks ?? []).map((b: any) =>
                  b._id === updatedBlock._id ? (updatedBlock as any) : b
                );
                patchPageAt(pageIdx, { content_blocks: updatedBlocks });
                setEditingBlock(null);
                setTimeout(() => {
                  document.querySelector<HTMLElement>(
                    `[data-block-id="${updatedBlock._id}"], #block-${updatedBlock._id}`
                  )?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 0);
              }}
              onClose={() => setEditingBlock(null)}
              errors={blockErrors}
              template={template}
            />
          </div>
        </div>
      )}
    </div>
  );
}
