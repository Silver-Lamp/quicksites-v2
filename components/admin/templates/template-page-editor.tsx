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

  const handleInsertBlockAt = (pageIndex: number, insertIndex: number, blockType: string) => {
    const newBlock = createDefaultBlock(blockType as any);
    const target = pages[pageIndex];
    if (!target) return;

    const newBlocks = [...(target.content_blocks || [])];
    newBlocks.splice(insertIndex, 0, newBlock);
    patchPageAt(pageIndex, { content_blocks: newBlocks });
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
      {Object.keys(blockErrors).length > 0 && showErrorBanner && (
        <div className="flex justify-between items-center border border-red-600 bg-red-900/10 text-red-300 px-4 py-2 rounded">
          <div>⚠ {Object.keys(blockErrors).length} block(s) have validation issues.</div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={scrollToFirstError}>
              Jump to First
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseCleanPages}>
              Collapse Clean Pages
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowErrorBanner(false)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

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
            <div className="flex justify-between items-center">
              <h4 className="text-md font-semibold">
                {page.title}
                {errorCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="ml-2 text-red-500">⚠️</span>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs max-w-sm">
                      {errorCount} validation issue{errorCount > 1 ? 's' : ''} on this page.
                    </TooltipContent>
                  </Tooltip>
                )}
              </h4>
              <div className="flex gap-4 items-center">
                <Label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={page.show_header ?? template.show_header ?? true}
                    onCheckedChange={(val) => patchPageAt(pageIndex, { show_header: val })}
                  />
                  Header
                </Label>
                <Label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={page.show_footer ?? template.show_footer ?? true}
                    onCheckedChange={(val) => patchPageAt(pageIndex, { show_footer: val })}
                  />
                    Footer
                  </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCollapsedPages((prev) => ({
                      ...prev,
                      [page.slug]: !prev[page.slug],
                    }))
                  }
                >
                  {collapsedPages[page.slug] ? 'Expand' : 'Collapse'}
                </Button>
              </div>
            </div>

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
                      onEdit={() => {}}
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

      <div className="rounded border-gray-700 bg-muted p-4">
        <h3 className="text-lg font-semibold mb-2">Add New Page</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Page Title"
            className="rounded border-gray-700 p-2 bg-white/5 text-white"
            value={newPageTitle}
            onChange={(e) => setNewPageTitle(e.target.value)}
          />
          <input
            type="text"
            placeholder="Slug"
            className="rounded border-gray-700 p-2 bg-white/5 text-white"
            value={newPageSlug}
            onChange={(e) => setNewPageSlug(e.target.value)}
          />
          <Button onClick={handleAddPage} className="w-full">
            + Add Page
          </Button>
        </div>
      </div>
    </div>
  );
}
