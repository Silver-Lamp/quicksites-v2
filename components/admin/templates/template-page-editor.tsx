'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { BlocksEditor } from './blocks-editor';
import { createDefaultPage } from '@/lib/pageDefaults';
import type { Template, TemplateData } from '@/types/template';
import type { Block } from '@/types/blocks';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import { createDefaultBlock } from '@/lib/createDefaultBlock';

type Props = {
  template: Template;
  onChange: (updated: Template) => void;
  onLivePreviewUpdate: (data: TemplateData) => void;
};

export default function TemplatePageEditor({
  template,
  onChange,
  onLivePreviewUpdate,
}: Props) {
  const [collapsedPages, setCollapsedPages] = useState<Record<string, boolean>>({});
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');

  const handleAddPage = () => {
    if (!newPageTitle || !newPageSlug) return;
    const newPage = createDefaultPage({ title: newPageTitle, slug: newPageSlug });
    const updated = {
      ...template,
      data: {
        ...template.data,
        pages: [...template.data.pages, newPage],
      },
    };
    onChange(updated);
    setNewPageTitle('');
    setNewPageSlug('');
  };

  const handlePageBlockChange = (pageIndex: number, updatedBlocks: Block[]) => {
    const newPages = template.data.pages.map((page, i) =>
      i === pageIndex ? { ...page, content_blocks: [...updatedBlocks] } : page
    );

    const updated = { ...template, data: { ...template.data, pages: newPages } };
    onChange(updated);
    onLivePreviewUpdate(updated.data);
  };

  const handleAddBlockToPage = (pageIndex: number, blockType: Block['type']) => {
    const newBlock = createDefaultBlock(blockType);

    const newPages = template.data.pages.map((page, i) =>
      i === pageIndex
        ? { ...page, content_blocks: [...page.content_blocks, newBlock] }
        : page
    );

    const updated = { ...template, data: { ...template.data, pages: newPages } };
    onChange(updated);
    onLivePreviewUpdate(updated.data);
  };

  return (
    <div className="space-y-6 border-gray-700 rounded p-4">

      {/* Pages with BlocksEditor and BlockAdder */}
      {template.data.pages.map((page, index) => (
        <div key={page.slug} className="border border-gray-700 rounded p-4 bg-muted space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-md font-semibold">{page.title}</h4>
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

          {!collapsedPages[page.slug] && (
            <>
              <BlocksEditor
                blocks={page.content_blocks}
                onChange={(updated) => handlePageBlockChange(index, updated)}
                industry={template.industry}
                onEdit={() => {}}
                onReplaceWithAI={() => {}}
              />

              <BlockAdderGrouped
                existingBlocks={page.content_blocks}
                onAdd={(type) => handleAddBlockToPage(index, type)}
              />
            </>
          )}
        </div>
      ))}

      {/* Page Add Form */}
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
