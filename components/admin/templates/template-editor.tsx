// components/admin/templates/template-editor.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, Dispatch, SetStateAction, useEffect } from 'react';
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

// patch bus (for wrapper-originated changes only)
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
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || 'Commit failed');

  // ✅ merge immediately so UI reflects the write before any refetch
  try {
    if (j?.template) {
      window.dispatchEvent(new CustomEvent('qs:template:merge', { detail: j.template }));
    } else {
      window.dispatchEvent(new Event('qs:template:invalidate'));
    }
  } catch {}

  // keep your existing signal
  try { window.dispatchEvent(new CustomEvent('qs:truth:refresh')); } catch {}

  return j;
}


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

// Small util for safe JSON preview
function preview(val: unknown, max = 160) {
  try {
    const s = typeof val === 'string' ? val : JSON.stringify(val);
    return s.length > max ? s.slice(0, max) + '…' : s;
  } catch {
    return String(val);
  }
}

// Highlight + scroll to a block in the preview
function revealBlock(blockId: string) {
  const esc = (globalThis as any).CSS?.escape ?? ((s: string) => s.replace(/"/g, '\\"'));
  const sel = `[data-block-id="${esc(blockId)}"]`;
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('ring-2', 'ring-red-500', 'ring-offset-2', 'ring-offset-zinc-900');
  setTimeout(() => {
    el.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2', 'ring-offset-zinc-900');
  }, 1400);
  return true;
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
      await commitNow((template as any).id, (template as any).data);            // save
      const sid = await createSnapshot((template as any).id);                   // snapshot
      await publishSnapshot((template as any).id, sid);                         // publish
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

  /** ✅ EditorContent calls this when the user edits.
   *  Update in-memory template ONLY — do **NOT** re-broadcast, or you’ll loop with the toolbar.
   */
  const handleEditorPatch = (patch: Partial<Template>) => {
    setTemplateSynced((prev) => withSyncedPages({ ...prev, ...patch }));
    // IMPORTANT: do NOT emit here — toolbar is the single subscriber to apply-patch.
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

  // 🔎 Build a quick lookup for block meta (type, page, index, page title/slug)
  const blockMetaById = useMemo(() => {
    const meta: Record<
      string,
      { type?: string; pageIndex: number; blockIndex: number; pageTitle?: string; slug?: string }
    > = {};
    const pages = getPages(template);
    pages.forEach((p: any, pi: number) => {
      const list = p?.content_blocks ?? p?.blocks ?? [];
      list?.forEach((b: any, bi: number) => {
        const id = b?._id ?? b?.id;
        if (!id) return;
        meta[id] = {
          type: b?.type,
          pageIndex: pi,
          blockIndex: bi,
          pageTitle: p?.title,
          slug: p?.slug ?? p?.path,
        };
      });
    });
    return meta;
  }, [template]);

  // 📋 Console diagnostics for easier debugging
  useEffect(() => {
    const entries = Object.entries(blockErrors);
    if (!entries.length) return;

    const rows = entries.flatMap(([blockId, errs]) => {
      const m = blockMetaById[blockId];
      return errs.map((e) => ({
        blockId,
        type: m?.type ?? '(unknown)',
        page: m ? `${m.pageIndex + 1}${m.slug ? ` (${m.slug})` : ''}` : '',
        index: m?.blockIndex ?? '',
        field: (e as any).field ?? '',
        message: (e as any).message ?? '',
        code: (e as any).code ?? '',
        expected: (e as any).expected ?? '',
        received: (e as any).received ?? '',
      }));
    });

    // eslint-disable-next-line no-console
    console.groupCollapsed('%cBlock validation errors', 'color:#ff8080');
    // eslint-disable-next-line no-console
    console.table(rows);
    // eslint-disable-next-line no-console
    console.groupEnd();
  }, [blockErrors, blockMetaById]);

  // 🧾 Render richer error summary with type + page context and extra fields
  const validationSummary = Object.entries(blockErrors).map(([blockId, errors]) => {
    const m = blockMetaById[blockId];
    const label =
      `Block ${m?.type ?? 'unknown'} `
      + `(${blockId})`
      + (m ? ` • page ${m.pageIndex + 1}${m.slug ? ` • ${m.slug}` : ''} • #${m.blockIndex + 1}` : '');

    const onReveal = () => {
      const ok = revealBlock(blockId);
      if (ok && m && m.pageIndex === 0) {
        setSelectedIndex(m.blockIndex);
      }
    };

    const copyDetails = async () => {
      try {
        const payload = { blockId, meta: m, errors };
        await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
        toast('Copied details', { icon: '📋' });
      } catch {
        // ignore
      }
    };

    return (
      <div key={blockId} className="text-sm text-red-300 border-b border-zinc-700 pb-2 mb-2">
        <div className="flex items-center justify-between gap-2">
          <strong className="text-red-200">{label}</strong>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onReveal} title="Reveal block">
              Reveal
            </Button>
            <Button size="sm" variant="ghost" onClick={copyDetails} title="Copy details">
              Copy
            </Button>
          </div>
        </div>
        <ul className="mt-1 space-y-1">
          {errors.map((e, i) => {
            const code = (e as any).code as string | undefined;
            const hint = (e as any).hint as string | undefined;
            const expected = (e as any).expected as unknown;
            const received = (e as any).received as unknown;
            const path =
              (e as any).path && Array.isArray((e as any).path)
                ? (e as any).path.join('.')
                : undefined;

            return (
              <li key={i} className="pl-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-red-100">{(e as any).message ?? 'Invalid'}</span>
                  {(e as any).field && (
                    <code className="px-1.5 py-0.5 rounded bg-red-950/40 border border-red-800/50 text-red-200 text-[11px]">
                      {(e as any).field}
                    </code>
                  )}
                  {path && (
                    <code className="px-1.5 py-0.5 rounded bg-zinc-800/60 border border-zinc-700 text-zinc-200 text-[11px]">
                      {path}
                    </code>
                  )}
                  {code && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/40 text-amber-200 text-[11px]">
                      {code}
                    </span>
                  )}
                </div>

                {(expected !== undefined || received !== undefined || hint) && (
                  <div className="mt-1 ml-1 space-y-0.5 text-[12px] text-zinc-300">
                    {expected !== undefined && (
                      <div>
                        <span className="text-zinc-400">expected:</span>{' '}
                        <code className="text-zinc-200">{preview(expected)}</code>
                      </div>
                    )}
                    {received !== undefined && (
                      <div>
                        <span className="text-zinc-400">received:</span>{' '}
                        <code className="text-zinc-200">{preview(received)}</code>
                      </div>
                    )}
                    {hint && (
                      <div>
                        <span className="text-zinc-400">hint:</span> {hint}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  });

  const handleCleanSaveDraft = async () => {
    try {
      const id = (template as any)?.id;
      if (!id) return toast.error('Missing template id');
      await commitNow(id, (template as any).data);
      // toast.success('Saved!');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Error saving template');
    }
  };

  return (
    <>
      <ScrollArea className="h-screen w-full p-10 overflow-y-auto">
        <TemplateEditorToolbar
          templateName={template.template_name || template.slug || 'Untitled'}
          autosaveStatus={autosave as any}
          isRenaming={isRenaming}
          setIsRenaming={setIsRenaming}
          inputValue={inputValue}
          setInputValue={setInputValue}
          slugPreview={slugPreview}
          handleRename={handleRename as () => void}
          handleSaveDraft={handleCleanSaveDraft}
          onBack={() =>
            router.push(initialMode === 'site' ? '/admin/sites' : '/admin/templates/list') as unknown as () => void
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
          onChange={handleEditorPatch}                      // ← no emit here
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
              // wrapper-originated change → emit data-only patch so toolbar persists
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
                // wrapper-originated change → emit data-only patch
                const pages = getPages({ data: template.data });
                emitPatch({ data: { ...(template.data ?? {}), pages } as any });
              } else {
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
