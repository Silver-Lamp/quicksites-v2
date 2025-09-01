// components/admin/templates/template-editor.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, Dispatch, SetStateAction } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TemplateEditorToolbar } from './template-editor-toolbar';
import { useTemplateEditorState } from './use-template-editor-state';
import EditorContent from '@/components/admin/templates/template-editor-content';
import { Drawer } from '@/components/ui/drawer';
import { Modal } from '@/components/ui/modal';
import VectorQueryPage from '@/app/admin/vector-query/page';
import type { Template } from '@/types/template';
import { Button } from '@/components/ui/button';
import { useTemplateInsert } from '@/hooks/useTemplateInsert';
import BlockSidebar from './block-sidebar';
import type { Block } from '@/types/blocks';
import { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import { toast } from 'react-hot-toast';
import { usePageCountDebugger } from '@/hooks/usePageCountDebugger';

// ---------- helpers ----------
function getPages(t: any) {
  if (Array.isArray(t?.data?.pages)) return t.data.pages;
  if (Array.isArray(t?.pages)) return t.pages;
  return [];
}

function withSyncedPages<T extends { data?: any; pages?: any[] }>(tpl: T): T {
  const pages = getPages(tpl);
  return { ...tpl, pages, data: { ...(tpl.data ?? {}), pages } } as T;
}

function emitPatch(patch: Partial<Template>) {
  try {
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
  } catch {}
}

async function loadRev(templateId: string) {
  const r = await fetch(`/api/templates/state?id=${templateId}`, { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || 'Failed loading state');
  return j?.infra?.template?.rev ?? 0;
}

async function commitNow(templateId: string, data: any) {
  const baseRev = await loadRev(templateId);
  const r = await fetch('/api/templates/commit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: templateId, baseRev, patch: { data }, kind: 'save' }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || 'Commit failed');
  try { window.dispatchEvent(new CustomEvent('qs:truth:refresh')); } catch {}
  return j;
}
// ⬇️ put these near commitNow() helpers
async function createSnapshot(templateId: string) {
  const res = await fetch(`/api/admin/snapshots/create?templateId=${templateId}`, { method: 'GET' });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Snapshot failed');
  return json?.snapshotId as string;
}
async function publishSnapshot(templateId: string, snapshotId: string) {
  const res = await fetch(`/api/admin/sites/publish?templateId=${templateId}&snapshotId=${snapshotId}`, { method: 'GET' });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Publish failed');
  return json;
}

// -----------------------------

export default function TemplateEditor({
  templateName,
  initialData,
  onRename,
  initialMode = 'template',
  colorMode = 'light',
}: {
  templateName: string;
  initialData?: Template;
  onRename?: (newName: string) => void;
  initialMode?: 'template' | 'site';
  colorMode?: 'light' | 'dark';
}) {
  const router = useRouter();
  const [showVectorDrawer, setShowVectorDrawer] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'insert' | 'replace'>('insert');
  const [targetBlockIndex, setTargetBlockIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [saveAndPublishBusy, setSaveAndPublishBusy] = useState(false);

  const handleSaveAndPublish = async () => {
    try {
      if (!(template as any)?.id) return toast.error('Missing template id');
      setSaveAndPublishBusy(true);
  
      // 1) Save (commit)
      await commitNow((template as any).id, (template as any).data);
  
      // 2) Snapshot
      const sid = await createSnapshot((template as any).id);
  
      // 3) Publish
      await publishSnapshot((template as any).id, sid);
  
      toast.success('Saved & Published!');
    } catch (e: any) {
      console.error('[save & publish] failed', e);
      toast.error(e?.message || 'Save & Publish failed');
    } finally {
      setSaveAndPublishBusy(false);
    }
  };
  
  const {
    template,
    setTemplate,
    autosave,
    isRenaming,
    setIsRenaming,
    handleRename,
    inputValue,
    setInputValue,
    slugPreview,
    nameExists,
    blockErrors,
    rawJson,
    setRawJson,
    setBlockErrors,
    livePreviewData,
  } = useTemplateEditorState({ templateName, initialData, onRename, colorMode, mode: initialMode });

  usePageCountDebugger(template as Template);

  // 🔒 Guard all template updates so pages never disappear
  const setTemplateSynced: Dispatch<SetStateAction<Template>> = (updater) => {
    if (typeof updater === 'function') {
      setTemplate((prev) =>
        withSyncedPages((updater as (p: Template) => Template)(withSyncedPages(prev)))
      );
    } else {
      setTemplate((prev) => withSyncedPages({ ...withSyncedPages(prev), ...updater }));
    }
  };

  // ✅ EditorContent requires onChange — merge patches safely + let autosave run
  const handleEditorPatch = (patch: Partial<Template>) => {
    setTemplateSynced((prev) => withSyncedPages({ ...prev, ...patch }));
    // Emit only what the commit API needs (data + optional chrome if included)
    const outgoing: Partial<Template> = { ...(patch.headerBlock ? { headerBlock: patch.headerBlock } : {}), ...(patch.footerBlock ? { footerBlock: patch.footerBlock } : {}), ...(patch.data ? { data: patch.data } : {}) };
    if (Object.keys(outgoing).length) emitPatch(outgoing);
  };

  const { insertBlock } =
    useTemplateInsert(setTemplateSynced as (updater: (prev: Template) => Template) => void);

  const handleUseBlock = (text: string, action: 'insert' | 'replace', index?: number) => {
    setPendingText(text);
    setPendingAction(action);
    setTargetBlockIndex(index ?? null);
    setShowVectorDrawer(false);
  };

  const selectedBlock =
    selectedIndex !== null ? template.data?.pages?.[0]?.content_blocks?.[selectedIndex] : null;
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

  const handleCleanSaveDraft = async () => {
    try {
      const id = (template as any)?.id;
      if (!id) return toast.error('Missing template id');
      await commitNow(id, (template as any).data);
      toast.success('Saved!');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Error saving template');
    }
  };

  return (
    <>
      <ScrollArea className="h-screen w-full p-10 overflow-y-auto">
        <TemplateEditorToolbar
          templateName={template.template_name}
          autosaveStatus={autosave as any}
          isRenaming={isRenaming}
          setIsRenaming={setIsRenaming}
          inputValue={inputValue}
          setInputValue={setInputValue}
          slugPreview={slugPreview}
          handleRename={handleRename as () => void}
          handleSaveDraft={handleCleanSaveDraft}
          onBack={() =>
            router.push(initialMode === 'site' ? '/admin/sites' : '/admin/templates') as unknown as () => void
          }
          nameExists={nameExists}
          setShowNameError={() => {}}
          onSaveAndPublish={handleSaveAndPublish}
          busy={saveAndPublishBusy}
        />

        {Object.keys(blockErrors).length > 0 && (
          <div className="bg-red-900/40 text-red-300 p-4 rounded border border-red-500 mb-4">
            <div className="font-bold text-red-200 mb-2">Some block(s) have validation errors:</div>
            {validationSummary}
          </div>
        )}

        <EditorContent
          template={withSyncedPages(template as Template)} // always feed synced shape
          onChange={handleEditorPatch}
          mode={initialMode}
          blockErrors={blockErrors as Record<string, BlockValidationError[]>}
          rawJson={rawJson}
          setRawJson={setRawJson}
          livePreviewData={livePreviewData}
          setTemplate={setTemplateSynced}
          autosaveStatus={autosave as any}
          setShowPublishModal={() => {}}
          recentlyInsertedBlockId={null}
          setBlockErrors={setBlockErrors as (errors: Record<string, BlockValidationError[]>) => void}
        />

        {selectedBlock && selectedIndex !== null && (
          <BlockSidebar
            block={selectedBlock}
            errors={(blockErrors[selectedId] as BlockValidationError[]) || []}
            onSave={(updatedBlock: Block) => {
              setTemplateSynced((prev) => {
                const updated = { ...prev };
                if (updated.data?.pages?.[0]?.content_blocks?.[selectedIndex]) {
                  updated.data.pages[0].content_blocks[selectedIndex] = updatedBlock;
                }
                return updated;
              });
              // emit data-only patch so autosave can commit
              const pages = getPages({ data: template.data });
              emitPatch({ data: { ...(template.data ?? {}), pages } as any });
            }}
            onClose={() => setSelectedIndex(null)}
            onOpen={selectedIndex !== null}
            onReplaceWithAI={() => {}}
            onClone={() => {}}
            onShowPrompt={() => {}}
            onUndo={() => {}}
            onViewDiff={() => {}}
            undoAvailable={false}
            template={template as unknown as Template}
          />
        )}
      </ScrollArea>

      <Drawer open={showVectorDrawer} onClose={() => setShowVectorDrawer(false)}>
        <VectorQueryPage
          onUseBlock={(text, mode = 'insert', index) =>
            handleUseBlock(text, mode as 'insert' | 'replace', index as number | undefined)
          }
        />
      </Drawer>

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
                setTemplateSynced((prev) => {
                  const updated = { ...prev };
                  if (updated.data?.pages?.[0]?.content_blocks?.[targetBlockIndex]) {
                    updated.data.pages[0].content_blocks[targetBlockIndex] = {
                      _id: updated.data.pages[0].content_blocks[targetBlockIndex]._id,
                      type: 'text',
                      content: { value: pendingText },
                      tags: ['ai'],
                      meta: {
                        ...updated.data?.pages?.[0]?.content_blocks?.[targetBlockIndex]?.meta,
                        prompt: pendingText,
                      },
                    } as any;
                  }
                  return updated;
                });
                // commit autosave (data only)
                const pages = getPages({ data: template.data });
                emitPatch({ data: { ...(template.data ?? {}), pages } as any });
              } else {
                // use your helper for insert and then emit a patch
                insertBlock(pendingText);
                const pages = getPages({ data: template.data });
                emitPatch({ data: { ...(template.data ?? {}), pages } as any });
              }
              setPendingText(null);
            }}
          >
            {pendingAction === 'replace' ? 'Replace Block' : 'Insert Block'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
