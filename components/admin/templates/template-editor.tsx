'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TemplateEditorToolbar } from './template-editor-toolbar';
import { useTemplateEditorState } from './use-template-editor-state';
import { TemplateEditorContent } from './template-editor-content';
import { Drawer } from '@/components/ui/drawer';
import { Modal } from '@/components/ui/modal';
import VectorQueryPage from '@/app/admin/vector-query/page';
import type { Snapshot, Template } from '@/types/template';
import { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { useTemplateInsert } from '@/hooks/useTemplateInsert';
import { BlocksEditor } from './blocks-editor';
import BlockSidebar from './block-sidebar';
import { Block, BlockSchema } from '@/admin/lib/zod/blockSchema';
import { z } from 'zod';
import { BlockValidationError } from '@/hooks/validateTemplateBlocks';

export default function TemplateEditor({
  templateName,
  initialData,
  onRename,
}: {
  templateName: string;
  initialData?: Snapshot;
  onRename?: (newName: string) => void;
}) {
  const router = useRouter();
  const [showVectorDrawer, setShowVectorDrawer] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'insert' | 'replace'>('insert');
  const [targetBlockIndex, setTargetBlockIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const {
    template,
    rawJson,
    setRawJson,
    livePreviewData,
    setTemplate,
    autosave,
    isCreating,
    isRenaming,
    setIsRenaming,
    handleRename,
    inputValue,
    setInputValue,
    slugPreview,
    handleSaveDraft,
    nameExists,
    blockErrors,
    setBlockErrors
  } = useTemplateEditorState({ templateName, initialData, onRename });

  const {
    insertBlock,
    undoInsert,
    recentlyInsertedBlockId,
    hasUndo,
  } = useTemplateInsert(setTemplate as unknown as (updater: (prev: Template) => Template) => void);

  const handleUseBlock = (text: string, action: 'insert' | 'replace', index?: number) => {
    setPendingText(text);
    setPendingAction(action);
    setTargetBlockIndex(index ?? null);
    setShowVectorDrawer(false);
  };

  const selectedBlock = selectedIndex !== null ? template.data.pages[0].content_blocks[selectedIndex] : null;
  const selectedId = selectedBlock?._id ?? '';

  const validationSummary = Object.entries(blockErrors).map(([blockId, errors]) => (
    <div key={blockId} className="text-sm text-red-300 border-b border-zinc-700 pb-2 mb-2">
      <strong className="text-red-400">Block {blockId}:</strong>
      <ul className="list-disc list-inside">
        {errors.map((e, i) => (
          <li key={i}>
            <code>{e.field}</code>: {e.message}
          </li>
        ))}
      </ul>
    </div>
  ));

  return (
    <>
      {/* Template Editor Toolbar */}
      <ScrollArea className="h-screen w-full p-6">
        <TemplateEditorToolbar
          templateName={template.template_name}
          autosaveStatus={autosave.status}
          isRenaming={isRenaming}
          setIsRenaming={setIsRenaming}
          inputValue={inputValue}
          setInputValue={setInputValue}
          slugPreview={slugPreview}
          handleRename={handleRename}
          handleSaveDraft={handleSaveDraft}
          onBack={() => router.push('/admin/templates')}
          nameExists={nameExists}
          setShowNameError={() => {}}
        />

        {/* Block Errors */}
        {Object.keys(blockErrors).length > 0 && (
          <div className="bg-red-900/40 text-red-300 p-4 rounded border border-red-500 mb-4">
            <div className="font-bold text-red-200 mb-2">Some block(s) have validation errors:</div>
            {validationSummary}
          </div>
        )}

        {/* Template Editor Content */}
        <TemplateEditorContent
          template={template as unknown as Template}
          rawJson={rawJson}
          setRawJson={setRawJson}
          livePreviewData={livePreviewData}
          setTemplate={setTemplate as unknown as Dispatch<SetStateAction<Template>>}
          autosaveStatus={autosave.status}
          setShowPublishModal={() => {}}
          recentlyInsertedBlockId={recentlyInsertedBlockId ?? null}
          setBlockErrors={setBlockErrors as unknown as (errors: Record<string, BlockValidationError[]>) => void}
          blockErrors={blockErrors as unknown as Record<string, BlockValidationError[]> | null  }
        />

        {/* Suggest Block */}
        {/* <div className="mt-6 flex gap-4">
          <Button onClick={() => setShowVectorDrawer(true)}>
            Suggest Block
          </Button>
          {hasUndo && (
            <Button variant="ghost" onClick={undoInsert}>
              Undo Last Insert
            </Button>
          )}
        </div> */}

        {/* Block Editor */}
        {selectedBlock && selectedIndex !== null && (
          <BlockSidebar
            block={selectedBlock}
            errors={blockErrors[selectedId] as unknown as BlockValidationError[] || []}
            onSave={(updatedBlock: Block) => {
              setTemplate((prev) => {
                const updated = { ...prev };
                updated.data.pages[0].content_blocks[selectedIndex] = updatedBlock;
                return updated;
              });
            }}
            onClose={() => setSelectedIndex(null)}
            onOpen={selectedIndex !== null}
            onReplaceWithAI={() => {}}
            onClone={() => {}}
            onShowPrompt={() => {}}
            onUndo={() => {}}
            onViewDiff={() => {}}
            undoAvailable={false}
          />
        )}
      </ScrollArea>

      {/* AI Block Suggestions */}
      <Drawer open={showVectorDrawer} onClose={() => setShowVectorDrawer(false)}>
        <VectorQueryPage
          onUseBlock={(text, mode = 'insert', index) => handleUseBlock(text, mode as 'insert' | 'replace', index as number | undefined)}
        />
      </Drawer>

      {/* AI Block Preview */}
      <Modal show={!!pendingText} onClose={() => setPendingText(null)} title="🧠 Preview AI Block">
        <textarea
          className="w-full border-gray-700 rounded bg-zinc-800 text-white p-2 text-sm mb-4"
          rows={5}
          value={pendingText || ''}
          onChange={(e) => setPendingText(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPendingText(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!pendingText) return;
              if (pendingAction === 'replace' && targetBlockIndex !== null) {
                setTemplate((prev) => {
                  const updated = { ...prev };
                  updated.data.pages[0].content_blocks[targetBlockIndex] = {
                    _id: updated.data.pages[0].content_blocks[targetBlockIndex]._id,
                    type: 'text',
                    content: { value: pendingText },
                    tags: ['ai'],
                    meta: {
                      ...updated.data.pages[0].content_blocks[targetBlockIndex].meta,
                      prompt: pendingText,
                    },
                  };
                  return updated;
                });
              } else {
                insertBlock(pendingText);
              }
              setPendingText(null);
            }}
          >
            {pendingAction === 'replace' ? 'Replace Block' : 'Insert Block'}
          </Button>
        </div>
      </Modal>
      <div>&nbsp;</div>
      <div>&nbsp;</div>
      <div>&nbsp;</div>
      <div>&nbsp;</div>
    </>
  );
}
