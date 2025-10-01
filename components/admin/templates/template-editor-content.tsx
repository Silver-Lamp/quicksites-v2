// components/admin/templates/template-editor-content.tsx
'use client';

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
  useRef,
  useCallback,
} from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import type { Template, TemplateData } from '@/types/template';
import type { Block } from '@/types/blocks';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';

import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor';
import LiveEditorPreviewFrame from '@/components/editor/live-editor/LiveEditorPreviewFrame';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import PageHeaderEditor from '@/components/admin/templates/block-editors/header-editor';
import PageFooterEditor from '@/components/admin/templates/block-editors/footer-editor';

import TemplateActionToolbar from '@/components/admin/templates/template-action-toolbar/TemplateActionToolbar';
import PageSettingsModal from '@/components/admin/templates/page-settings-modal';
import { useTruthTrackerState } from './hooks/useTruthTrackerState';
import TemplateTruthTracker from '@/components/admin/templates/truth/TemplateTruthTracker';

import NewTemplateWelcome from '@/components/admin/templates/NewTemplateWelcome';
import CollapsiblePanel from '@/components/ui/collapsible-panel';
import type {
  InfraState,
  SnapshotInfo,
  TemplateEvent,
  VersionTagInfo,
} from '@/components/admin/templates/truth/types';

import {
  // (kept imports; not strictly required with the new set/emit path)
  insertBlockEmit,
  removeBlockEmit,
  replaceBlockEmit,
  moveBlockEmit,
} from '@/components/admin/templates/utils/blocks-patch';

import { X } from 'lucide-react';

const SidebarSettings = dynamic(
  () => import('@/components/admin/template-settings-panel/sidebar-settings'),
  { ssr: false }
);

type TemplateDataWithChrome = TemplateData & {
  headerBlock?: Block | null;
  footerBlock?: Block | null;
};

/* ---------- helpers ---------- */
export function getTemplatePages(t: Template): any[] {
  const d: any = t ?? {};
  if (Array.isArray(d?.data?.pages)) return d.data.pages;
  if (Array.isArray(d?.pages)) return d.pages;
  return [];
}
function firstPageSlug(t: Template): string {
  const pages = getTemplatePages(t);
  if (pages.length)
    return pages.find((p) => p?.slug)?.slug ?? pages[0]?.slug ?? 'index';
  return 'index';
}
function getPageBlocks(p: any): Block[] {
  if (!p) return [];
  if (Array.isArray(p?.blocks)) return p.blocks as Block[];
  if (Array.isArray(p?.content?.blocks)) return p.content.blocks as Block[];
  if (Array.isArray(p?.content_blocks)) return p.content_blocks as Block[];
  return [];
}
function setPageBlocks(p: any, blocks: Block[]) {
  let wrote = false;
  if (Array.isArray(p?.blocks)) {
    p.blocks = blocks;
    wrote = true;
  }
  if (Array.isArray(p?.content_blocks)) {
    p.content_blocks = blocks;
    wrote = true;
  }
  if (Array.isArray(p?.content?.blocks)) {
    p.content = { ...(p.content ?? {}), blocks };
    wrote = true;
  }
  if (!wrote) {
    p.content = { ...(p?.content ?? {}), blocks };
  }
}

// NEW: id helpers are tolerant to _id | id (and string coerce)
const bid = (b: any) => String(b?._id ?? b?.id ?? '');
const eqId = (b: any, id: string) => bid(b) === String(id);

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    html.style.setProperty('scrollbar-gutter', 'stable');

    const prevOverflow = body.style.overflow;
    const prevPadRight = body.style.paddingRight;

    if (locked) {
      const scrollbar = window.innerWidth - html.clientWidth;
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = '';
      body.style.paddingRight = '';
    }

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadRight;
    };
  }, [locked]);
}

/* ---------- component ---------- */
type Props = {
  template: Template;
  rawJson: string;
  setRawJson: Dispatch<SetStateAction<string>>;
  livePreviewData: TemplateData;
  setTemplate: Dispatch<SetStateAction<Template>>;
  autosaveStatus?: string | undefined;
  setShowPublishModal?: (open: boolean) => void;
  recentlyInsertedBlockId?: string | null;
  setBlockErrors: (errors: Record<string, BlockValidationError[]>) => void;
  blockErrors: Record<string, BlockValidationError[]>;
  mode: 'template' | 'site';
  onChange: (patch: Partial<Template>) => void;
};

export default function EditorContent({
  template,
  rawJson,
  setRawJson,
  livePreviewData,
  setTemplate,
  autosaveStatus,
  setShowPublishModal,
  recentlyInsertedBlockId,
  setBlockErrors,
  blockErrors,
  mode,
  onChange,
}: Props) {
  const searchParams = useSearchParams();
  const previewVersionId = searchParams.get('preview_version_id');
  const tab = (searchParams.get('tab') ?? 'blocks') as 'blocks' | 'live';
  const currentPageSlug = useMemo(
    () => searchParams.get('page') ?? firstPageSlug(template),
    [searchParams, template]
  );

  const [showSettings, setShowSettings] = useState(false);
  // Press 's' to toggle settings drawer (and 'Escape' to close)
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      if (!n) return false;
      if (n.isContentEditable) return true;
      const tag = (n.tagName || '').toLowerCase();
      const inEditors = !!n.closest?.('.cm-editor, .CodeMirror, .ProseMirror');
      return tag === 'input' || tag === 'textarea' || tag === 'select' || inEditors;
    };

    const onKey = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase();
      const code = (e.code || '').toLowerCase();

      // Only plain 's'
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (key === 's' || code === 'keys') {
          if (isTypingTarget(e.target)) return;
          e.preventDefault();
          setShowSettings((prev) => !prev);
        }
      }

      // ESC closes when open
      if (key === 'escape' && showSettings) {
        e.preventDefault();
        setShowSettings(false);
      }
    };

    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey as any, { capture: true } as any);
  }, [showSettings]);

  // Listen for toolbar-driven settings toggles
  useEffect(() => {
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // If a boolean is provided, set explicitly; otherwise toggle
      if (typeof detail === 'boolean') setShowSettings(detail);
      else setShowSettings((v) => !v);
    };

    // New canonical event
    window.addEventListener('qs:settings:toggle', onToggle as any);
    // Back-compat: allow explicit open/close via boolean detail
    window.addEventListener('qs:settings:set-open', onToggle as any);

    return () => {
      window.removeEventListener('qs:settings:toggle', onToggle as any);
      window.removeEventListener('qs:settings:set-open', onToggle as any);
    };
  }, []);

  useBodyScrollLock(showSettings);

  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [editingHeader, setEditingHeader] = useState<Block | null>(null);
  const [editingFooter, setEditingFooter] = useState<Block | null>(null);

  // NEW: editor + picker state actually used below
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [adderTarget, setAdderTarget] = useState<string | null>(null);

  const [showWelcome, setShowWelcome] = useState(false);

  // ---------- Truth Tracker ----------
  function TruthTrackerPanel({ templateId }: { templateId: string }) {
    const { state, loading, error, reload } = useTruthTrackerState(templateId);
    const adminMeta = state?.rawState?.adminMeta ?? undefined;
    if (loading || !state) return null;
    const { infra, snapshots, versions, events } = state;

    return (
      <TemplateTruthTracker
        templateId={templateId}
        infra={infra as InfraState}
        snapshots={snapshots as SnapshotInfo[]}
        versions={versions as unknown as VersionTagInfo[]}
        events={events as TemplateEvent[]}
        selectedSnapshotId={infra?.lastSnapshot?.id}
        adminMeta={adminMeta as { deprecated_files?: string[] } | undefined}
        onRefresh={reload}
        onViewDiff={() => {}}
      />
    );
  }

  const preferInlinePreview = useMemo(() => tab !== 'live', [tab]);
  const pages = useMemo(() => getTemplatePages(template), [template]);
  const currentPage = useMemo(() => {
    return pages.find((p: any) => p?.slug === currentPageSlug) ?? pages[0] ?? null;
  }, [pages, currentPageSlug]);

  // ------- NEW: helpers to find/patch blocks on current page -------
  const updateTemplateWithBlocks = useCallback(
    (nextBlocks: Block[]) => {
      const idx = pages.findIndex((p: any) => p?.slug === currentPageSlug);
      const targetIdx = idx >= 0 ? idx : 0;
      const nextPages = [...pages];
      const nextPage = { ...nextPages[targetIdx] };
      setPageBlocks(nextPage, nextBlocks);
      nextPages[targetIdx] = nextPage;

      const nextTemplate: any = Array.isArray((template as any)?.data?.pages)
        ? { ...template, data: { ...(template as any).data, pages: nextPages } }
        : { ...template, pages: nextPages };

      setTemplate(nextTemplate);
      onChange(nextTemplate);

      // Inform any listeners (commit builder, mirrors, etc.)
      const basePrefix = Array.isArray((template as any)?.data?.pages) ? '/data/pages' : '/pages';
      const patchPath =
        Array.isArray((currentPage as any)?.content_blocks)
          ? `${basePrefix}/${targetIdx}/content_blocks`
          : Array.isArray((currentPage as any)?.blocks)
            ? `${basePrefix}/${targetIdx}/blocks`
            : `${basePrefix}/${targetIdx}/content/blocks`;

      try {
        window.dispatchEvent(new CustomEvent('qs:template:apply-patch', {
          detail: { op: 'set', path: patchPath, value: nextBlocks, data: (nextTemplate as any)?.data }
        }));
      } catch {}
    },
    [pages, currentPageSlug, template, setTemplate, onChange, currentPage]
  );

  const insertBlockAfter = useCallback(
    (newBlock: Block, afterId: string | null) => {
      const blocks = [...getPageBlocks(currentPage)];
      let at = 0;
      if (afterId && afterId !== '__ADD_AT_START__') {
        const idx = blocks.findIndex((b) => String((b as any)._id ?? b.id) === String(afterId));
        at = idx >= 0 ? idx + 1 : blocks.length;
      }
      const next = [...blocks.slice(0, at), newBlock, ...blocks.slice(at)];
      updateTemplateWithBlocks(next);
    },
    [currentPage, updateTemplateWithBlocks]
  );  

  const replaceBlockById = useCallback(
    (updated: Block) => {
      const blocks = [...getPageBlocks(currentPage)];
      const idx = blocks.findIndex((b) => eqId(b, bid(updated)));
      if (idx < 0) return;
      blocks[idx] = updated;
      updateTemplateWithBlocks(blocks);
    },
    [currentPage, updateTemplateWithBlocks]
  );

  // Open the Page Header Editor when the preview (iframe) asks for it
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.type === 'qs:edit-header') {
        const existing =
          ((template as any)?.data?.headerBlock as Block | undefined) ??
          (createDefaultBlock('header') as Block);
        setEditingHeader(existing);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [template]);

  // Open the Page Footer Editor when the preview (iframe) asks for it
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.type === 'qs:edit-footer') {
        const existing =
          ((template as any)?.data?.footerBlock as Block | undefined) ??
          (createDefaultBlock('footer') as Block);
        setEditingFooter(existing);
      }
    };

    // (Optional) also support an in-page CustomEvent('qs:edit-footer')
    const onCustom = () => {
      const existing =
        ((template as any)?.data?.footerBlock as Block | undefined) ??
        (createDefaultBlock('footer') as Block);
      setEditingFooter(existing);
    };

    window.addEventListener('message', onMsg);
    window.addEventListener('qs:edit-footer' as any, onCustom as any);
    return () => {
      window.removeEventListener('message', onMsg);
      window.removeEventListener('qs:edit-footer' as any, onCustom as any);
    };
  }, [template]);

  // ------- NEW: render the actual editor for a selected block id -------
  const editingBlockObj = useMemo(() => {
    if (!editingBlockId) return null;
    return getPageBlocks(currentPage).find((b) => eqId(b, editingBlockId)) ?? null;
  }, [currentPage, editingBlockId]);

  // ------- NEW: handlers passed to preview frame -------
  const handleEditBlock = useCallback((id: string) => setEditingBlockId(id), []);
  const handleAddAfter  = useCallback((id: string) => setAdderTarget(id), []);
  const handleDelete    = useCallback((_id: string) => {
    // Deletion is already handled optimistically inside the preview frame.
    // You can add side-effects here if needed (analytics, toasts, etc.).
  }, []);

  const savePageSettings = (updatedPage: any) => {
    const pages = [...getTemplatePages(template)];
    const idx = pages.findIndex((p: any) => p?.slug === currentPageSlug);
    const targetIdx = idx >= 0 ? idx : 0;
    pages[targetIdx] = { ...pages[targetIdx], ...updatedPage };

    const nextTemplate: any = Array.isArray((template as any)?.data?.pages)
      ? { ...template, data: { ...(template as any).data, pages } }
      : { ...template, pages };

    setTemplate(nextTemplate);
    onChange(nextTemplate);
  };

  return (
    <div className="relative flex min-w-0 w-full [scrollbar-gutter:stable]">
      {showWelcome && <NewTemplateWelcome onStart={() => setShowWelcome(false)} />}

      <div className="flex-1 min-w-0 xl:ml-0 ml-0 px-0 lg:px-2">
        {editingHeader && (
          <div className="mb-4 rounded-xl border border-white/10 bg-neutral-950/70 backdrop-blur">
            <PageHeaderEditor
              block={editingHeader}
              onSave={(b) => {
                setTemplate({
                  ...template,
                  data: { ...(template.data as any), headerBlock: b },
                });
                setEditingHeader(null);
              }}
              onClose={() => setEditingHeader(null)}
              template={template}
              errors={blockErrors}
            />
          </div>
        )}
        
        {editingFooter && (
          <div className="mb-4 rounded-xl border border-white/10 bg-neutral-950/70 backdrop-blur">
            <PageFooterEditor
              block={editingFooter}
              template={template}
              errors={blockErrors}
              onClose={() => setEditingFooter(null)}
              onSave={(b) => {
                const next = {
                  ...template,
                  data: { ...(template.data as any), footerBlock: b },
                } as Template;
                setTemplate(next);
                onChange(next);
                setEditingFooter(null);
              }}
            />
          </div>
        )}

        <LiveEditorPreviewFrame
          template={template}
          onChange={(t) => {
            setTemplate(t);
            onChange(t);
          }}
          errors={blockErrors}
          industry={template.industry}
          templateId={template.id}
          mode={mode}
          preferInlinePreview={preferInlinePreview}
          rawJson={rawJson}
          setRawJson={setRawJson}
          setTemplate={(t) => setTemplate(t)}
          showEditorChrome
          onEditHeader={() => {
            const existing =
              ((template as any)?.data?.headerBlock as Block | undefined) ??
              (createDefaultBlock('header') as Block);
            setEditingHeader(existing);
          }}
          onRequestEditBlock={handleEditBlock}
          onRequestAddAfter={handleAddAfter}
          onRequestDeleteBlock={handleDelete}
          previewVersionId={previewVersionId}
          pageSlug={currentPageSlug}
        />
      </div>

      {/* Settings Drawer */}
      {showSettings && (
        <div className="fixed inset-0 z-[1300] bg-black/70 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 w-[min(92vw,1000px)] max-w-[1000px] h-full shadow-2xl">
            <div className="h-full bg-neutral-900 border-l border-white/10 flex flex-col">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-3 border-b border-white/10 bg-neutral-900/95 backdrop-blur">
                <div className="text-sm text-white/80">
                  <strong>Site Settings</strong>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm bg-white/10 hover:bg-white/20 text-white"
                >
                  <X className="h-4 w-4" />
                  Close
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto p-0">
                {SidebarSettings ? (
                  <>
                    {template.id && (
                      <div className="mt-3 w-full">
                        <CollapsiblePanel
                          id="truth-tracker"
                          title="History"
                          defaultOpen={false}
                          lazyMount
                        >
                          {() => <TruthTrackerPanel templateId={template.id} />}
                        </CollapsiblePanel>
                      </div>
                    )}
                    <SidebarSettings
                      template={template}
                      onChange={onChange}
                      variant="drawer"
                    />
                  </>
                ) : (
                  <div className="p-4 text-sm text-white/70">Loading settings…</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Block Picker (opens when user clicks "add") */}
      {adderTarget !== null && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40"
          onClick={() => setAdderTarget(null)}
        >
          <div
            className="max-h-[85vh] w-[min(92vw,1000px)] max-w-[1000px] overflow-auto rounded-lg border border-white/10 bg-neutral-950 p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <BlockAdderGrouped
              inline                              // ⬅️ important: render content now
              template={template}
              existingBlocks={getPageBlocks(currentPage)}
              onClose={() => setAdderTarget(null)}
              // Quick picks call this first if provided:
              onAddAndEdit={(type) => {
                const block = createDefaultBlock(type) as Block;
                insertBlockAfter(block, adderTarget);
                setAdderTarget(null);
                // open the editor immediately for the newly inserted block
                setEditingBlockId(String((block as any)._id ?? (block as any).id));
              }}
              // All other list items call onAdd:
              onAdd={(type) => {
                const block = createDefaultBlock(type) as Block;
                insertBlockAfter(block, adderTarget);
                setAdderTarget(null);
                // optional: also jump into the editor
                setEditingBlockId(String((block as any)._id ?? (block as any).id));
              }}
            />
          </div>
        </div>
      )}

      {/* NEW: Block Editor Drawer (opens when user clicks "edit") */}
      {editingBlockObj && (
        <div className="fixed inset-0 z-[1250] flex">
          <div className="flex-1 bg-black/60" onClick={() => setEditingBlockId(null)} />
          <div className="w-[min(92vw,900px)] max-w-[900px] h-full bg-neutral-900 border-l border-white/10">
            <DynamicBlockEditor
              block={editingBlockObj}
              template={template}
              currentPage={currentPage}
              colorMode="light" // or derive from template/site mode if you prefer
              errors={blockErrors}
              onClose={() => setEditingBlockId(null)}
              onChange={(updated) => {
                replaceBlockById(updated);
              }}
              onSave={(updated) => {
                replaceBlockById(updated);
                setEditingBlockId(null);
              }}
            />
          </div>
        </div>
      )}


      <TemplateActionToolbar
        template={template}
        autosaveStatus={autosaveStatus as string | undefined}
        onSaveDraft={(t: Template | undefined) => {
          if (!t) return;
          setTemplate(t);
          onChange(t);
        }}
        onUndo={() => {}}
        onRedo={() => {}}
        onOpenPageSettings={() => setPageSettingsOpen(true)}
        onApplyTemplate={(t: Template) => {
          setTemplate(t);
          onChange(t);
        }}
        onSetRawJson={setRawJson}
      />

      <PageSettingsModal
        open={pageSettingsOpen}
        page={currentPage}
        onClose={() => setPageSettingsOpen(false)}
        onSave={savePageSettings}
        template={template}
        errors={blockErrors}
      />
    </div>
  );
}
