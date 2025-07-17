'use client';

import { useState } from 'react';
import { JsonEditorOverlay } from './json-editor-overlay';
import { SquatbotOverlayToggle } from './squatbot-overlay-toggle';
import { FloatingAddPageButton } from './floating-add-page-button';
import { EditorSidebarOutline } from './editor-sidebar-outline';
import { MotionBlockWrapper } from './motion-block-wrapper';
import { BlockOverlayControls } from './block-overlay-controls';
import { FloatingAddBlockHere } from './floating-add-block-here';
import { InlineBlockTypePicker } from './inline-block-type-picker';
import { AISuggestionOverlay } from './ai-suggestion-overlay';

export function EditorContentOverlay({
  template,
  rawJson,
  setRawJson,
  onChange,
}: {
  template: any;
  rawJson: string;
  setRawJson: (v: string) => void;
  onChange: (updated: any) => void;
}) {
  const [showJson, setShowJson] = useState(false);
  const [squatbotMode, setSquatbotMode] = useState(true);

  const handleBlockDelete = (pageIndex: number, blockIndex: number) => {
    const updated = { ...template };
    updated.data.pages[pageIndex].content_blocks.splice(blockIndex, 1);
    onChange(updated);
  };

  const handleAddBlock = (pageIndex: number, type = 'text') => {
    const newBlock = {
      _id: crypto.randomUUID(),
      type,
      content: {},
      meta: {},
      tags: [],
    };
    const updated = { ...template };
    updated.data.pages[pageIndex].content_blocks.push(newBlock);
    onChange(updated);
  };

  const handleAddPage = () => {
    const updated = { ...template };
    updated.data.pages.push({
      id: `page-${Date.now()}`,
      slug: `page-${updated.data.pages.length + 1}`,
      title: 'New Page',
      content_blocks: [],
    });
    onChange(updated);
  };

  return (
    <>
      {squatbotMode && <EditorSidebarOutline pages={template.data.pages} />}
      {squatbotMode && <FloatingAddPageButton onClick={handleAddPage} />}

      {squatbotMode && (
        <div className="space-y-6 px-6 py-4">
          {template.data.pages.map((page: any, pageIndex: number) => (
            <div key={page.slug} id={page.slug} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">{page.title}</h2>

              {page.content_blocks.map((block: any, blockIndex: number) => (
                <MotionBlockWrapper key={block._id}>
                  <div className="relative block-hover rounded border border-white/10 p-3">
                    <BlockOverlayControls
                      onEdit={() => alert(`Edit ${block.type}`)}
                      onDelete={() => handleBlockDelete(pageIndex, blockIndex)}
                    />
                    <pre className="text-xs text-white/80">{block.type}</pre>
                    <FloatingAddBlockHere onAdd={() => handleAddBlock(pageIndex)} />
                  </div>
                </MotionBlockWrapper>
              ))}

              <InlineBlockTypePicker
                onSelect={(type) => handleAddBlock(pageIndex, type)}
              />

              <div className="pt-2">
                <AISuggestionOverlay onSelect={(text) => console.log(`AI Suggested: ${text}`)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <SquatbotOverlayToggle
        active={squatbotMode}
        onToggle={() => setSquatbotMode((v) => !v)}
      />

      {showJson && (
        <JsonEditorOverlay
          rawJson={rawJson}
          setRawJson={setRawJson}
          onClose={() => setShowJson(false)}
        />
      )}
    </>
  );
}
