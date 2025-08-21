// components/admin/templates/template-page-editor.tsx
'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui';
import { BlocksEditor } from './blocks-editor';
import { createDefaultPage } from '@/lib/pageDefaults';
import type { Template, TemplateData, Page } from '@/types/template';
import type { Block } from '@/types/blocks';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import { FloatingAddBlockHere } from '@/components/editor/floating-add-block-here';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor';

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

  // Which block/page is in the editor
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [editingPageIndex, setEditingPageIndex] = useState<number | null>(null); // null => chrome (header)

  const pages: Page[] = Array.isArray(template.data?.pages) ? template.data!.pages : [];

  // ---- header-as-block helpers ----
  const getResolvedHeaderBlock = (): Block => {
    const existing =
      (template as any)?.data?.headerBlock ||
      (template as any)?.headerBlock ||
      null;

    if (existing?.type === 'header') return existing as Block;

    // seed a default header block if none present
    const seeded = createDefaultBlock('header') as Block;

    // Optionally seed nav items from pages
    const navItems =
      pages?.slice(0, 5)?.map((p) => ({ label: p.title || p.slug, href: `/${p.slug}` })) ?? [];
    (seeded as any).content = {
      ...(seeded as any).content,
      navItems: (seeded as any).content?.navItems?.length
        ? (seeded as any).content.navItems
        : navItems,
    };
    return seeded;
  };

  const openHeaderEditor = () => {
    const hdr = getResolvedHeaderBlock();
    setEditingBlock(hdr);
    setEditingPageIndex(null); // mark as chrome edit
    // scroll to top where header renders in preview
    setTimeout(() => {
      document
        .querySelector<HTMLElement>('[data-site-header], .qs-site-header')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const commitHeader = (nextHeader: Block | null) => {
    const updated: Template = {
      ...template,
      // Mirror for convenience
      ...(nextHeader ? { headerBlock: nextHeader } : { headerBlock: undefined }),
      data: {
        ...(template.data ?? {}),
        ...(nextHeader
          ? { headerBlock: nextHeader }
          : (() => {
              const d = { ...(template.data ?? {}) } as any;
              delete d.headerBlock;
              return d;
            })()),
      },
    };
    onChange(updated);
    onLivePreviewUpdate(updated.data!);
  };

  // Attach error-based expand/collapse & first-error scroll
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
  }, [template.data?.pages, blockErrors, pages]);

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

  // Insert then immediately open editor
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
      document
        .querySelector<HTMLElement>(`[data-block-id="${newBlock._id}"], #block-${newBlock._id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  };

  const resolvedColorMode = template?.color_mode || 'dark';

  // ---- Portal target for header hover chrome ----
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // Try to find the header element in the preview
    const el = document.querySelector<HTMLElement>('[data-site-header], .qs-site-header');
    setHeaderHost(el || null);
  }, [
    (template as any)?.data?.headerBlock, // re-query if header changes
    template?.headerBlock,
    pages?.length,
    resolvedColorMode,
  ]);

  return (
    <div className="space-y-6 border-gray-700 rounded p-4">
      {/* ===== Header hover chrome (rendered INSIDE the header via portal) ===== */}
      {headerHost &&
        createPortal(
          <button
            type="button"
            className="pointer-events-auto absolute right-2 top-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity text-xs rounded-md bg-black/60 hover:bg-black text-white px-2 py-1"
            onClick={(e) => {
              e.stopPropagation();
              openHeaderEditor();
            }}
            // Ensure it's only visible when header root has .group
            // Our header renderer should have 'relative group' on root.
          >
            Edit Header
          </button>,
          headerHost
        )}
      {/* ===== /Header hover chrome ===== */}

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
            {/* Page header (title, collapse, etc.) could be here */}

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
                      onEdit={(b: Block) => {
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

      {/* Add New Page UI could be here... */}
      <div className="flex items-end gap-2">
        <input
          className="px-2 py-1 rounded bg-transparent border border-white/10"
          placeholder="New page title"
          value={newPageTitle}
          onChange={(e) => setNewPageTitle(e.target.value)}
        />
        <input
          className="px-2 py-1 rounded bg-transparent border border-white/10"
          placeholder="new-page-slug"
          value={newPageSlug}
          onChange={(e) => setNewPageSlug(e.target.value)}
        />
        <Button size="sm" variant="secondary" onClick={handleAddPage}>
          Add Page
        </Button>
      </div>

      {/* Overlay editor */}
      {editingBlock && (
        <div className="fixed inset-0 bg-black/90 z-[999] p-6 overflow-auto flex items-center justify-center">
          <div className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
            <DynamicBlockEditor
              block={editingBlock}
              onSave={(updatedBlock: any) => {
                // If we are editing chrome (header), editingPageIndex === null
                if (editingPageIndex === null || updatedBlock?.type === 'header') {
                  commitHeader(updatedBlock as Block);
                  setEditingBlock(null);
                  setTimeout(() => {
                    document
                      .querySelector<HTMLElement>('[data-site-header], .qs-site-header')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 0);
                  return;
                }

                // Otherwise find and replace in the page blocks
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
                  document
                    .querySelector<HTMLElement>(
                      `[data-block-id="${updatedBlock._id}"], #block-${updatedBlock._id}`
                    )
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 0);
              }}
              onClose={() => setEditingBlock(null)}
              errors={blockErrors}
              template={template}
              colorMode={resolvedColorMode}
            />
          </div>
        </div>
      )}
    </div>
  );
}
