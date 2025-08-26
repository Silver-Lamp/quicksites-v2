'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import type { Template, TemplateData } from '@/types/template';
import type { Block } from '@/types/blocks';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';

import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor';
import LiveEditorPreviewFrame from '@/components/editor/live-editor/LiveEditorPreviewFrame';
import { Settings as SettingsIcon } from 'lucide-react';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import PageHeaderEditor from '@/components/admin/templates/block-editors/header-editor';
import { TemplateActionToolbar } from '@/components/admin/templates/template-action-toolbar';
import PageSettingsModal from '@/components/admin/templates/page-settings-modal';

const SidebarSettings = dynamic(
  () => import('@/components/admin/template-settings-panel/sidebar-settings'),
  { ssr: false }
);

type TemplateDataWithChrome = TemplateData & { headerBlock?: Block | null; footerBlock?: Block | null };

/* ---------- helpers ---------- */
export function getTemplatePages(t: Template): any[] {
  const d: any = t ?? {};
  if (Array.isArray(d?.data?.pages)) return d.data.pages;
  if (Array.isArray(d?.pages)) return d.pages;
  return [];
}
function firstPageSlug(t: Template): string {
  const pages = getTemplatePages(t);
  if (pages.length) return pages.find(p => p?.slug)?.slug ?? pages[0]?.slug ?? 'home';
  return 'home';
}
function getPageBlocks(p: any): Block[] {
  if (!p) return [];
  if (Array.isArray(p?.blocks)) return p.blocks as Block[];
  if (Array.isArray(p?.content?.blocks)) return p.content.blocks as Block[];
  if (Array.isArray(p?.content_blocks)) return p.content_blocks as Block[];
  return [];
}
function setPageBlocks(p: any, blocks: Block[]) {
  if (Array.isArray(p?.blocks)) p.blocks = blocks;
  else if (Array.isArray(p?.content_blocks)) p.content_blocks = blocks;
  else p.content = { ...(p?.content ?? {}), blocks };
}
function findBlockById(
  t: Template,
  id: string
): { pageIdx: number; blockIdx: number; block: Block } | null {
  const pages = getTemplatePages(t);
  for (let p = 0; p < pages.length; p++) {
    const blocks = getPageBlocks(pages[p]);
    for (let b = 0; b < blocks.length; b++) {
      const blk: any = blocks[b];
      const bid = blk?._id || blk?.id;
      if (String(bid) === String(id)) return { pageIdx: p, blockIdx: b, block: blocks[b] };
    }
  }
  return null;
}
function parseBlockPath(path?: string | null) {
  if (!path) return null;
  const m = String(path).match(/^(\d+):(\d+)$/);
  return m ? { pageIdx: Number(m[1]), blockIdx: Number(m[2]) } : null;
}
function findBlockByPath(t: Template, path?: string | null) {
  const parsed = parseBlockPath(path);
  if (!parsed) return null;
  const pages = getTemplatePages(t);
  if (parsed.pageIdx < 0 || parsed.pageIdx >= pages.length) return null;
  const page = pages[parsed.pageIdx];
  const blocks = getPageBlocks(page);
  if (parsed.blockIdx < 0 || parsed.blockIdx >= blocks.length) return null;
  return { pageIdx: parsed.pageIdx, blockIdx: parsed.blockIdx, block: blocks[parsed.blockIdx] };
}

/* ---------- component ---------- */
type Props = {
  template: Template;
  rawJson: string;
  setRawJson: Dispatch<SetStateAction<string>>;
  livePreviewData: TemplateData;
  setTemplate: Dispatch<SetStateAction<Template>>;
  autosaveStatus?: string;
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
  const currentPageSlug = useMemo(
    () => searchParams.get('page') ?? firstPageSlug(template),
    [searchParams, template]
  );

  const [showSettings, setShowSettings] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);

  // header panel above preview
  const [editingHeader, setEditingHeader] = useState<Block | null>(null);

  // non-header block modal
  const [editingBlock, setEditingBlock] = useState<{ ref: ReturnType<typeof findBlockById> | ReturnType<typeof findBlockByPath> } | null>(null);

  // block adder
  const [adderTarget, setAdderTarget] = useState<null | { pageIdx: number; insertAt: number }>(null);

  /* keyboard: S toggles settings */
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      if (!n) return false;
      const editable =
        (n.getAttribute?.('contenteditable') || '').toLowerCase() === 'true' ||
        n.closest?.('[contenteditable="true"]');
      const tag = (n.tagName || '').toLowerCase();
      const isForm =
        tag === 'input' || tag === 'textarea' || tag === 'select' || (n as HTMLInputElement).type === 'text';
      const isEditors = n.closest?.('.cm-editor, .CodeMirror, .ProseMirror');
      return !!(editable || isForm || isEditors);
    };
    const onKey = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase();
      const code = (e.code || '').toLowerCase();
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (key === 's' || code === 'keys') {
          if (isTypingTarget(e.target)) return;
          e.preventDefault();
          setShowSettings(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', onKey, { capture: true, passive: false });
    return () => window.removeEventListener('keydown', onKey as any, { capture: true } as any);
  }, []);

  /* header editor wiring */
  const resolveHeader = (): Block => {
    const existing =
      (template as any)?.data?.headerBlock ||
      (template as any)?.headerBlock ||
      null;
    if (existing?.type === 'header') return existing as Block;

    const seeded = createDefaultBlock('header') as Block;
    const navItems =
      getTemplatePages(template).slice(0, 5).map((p: any) => ({ label: p.title || p.slug, href: `/${p.slug}` })) ?? [];
    (seeded as any).content = {
      ...(seeded as any).content,
      nav_items: (seeded as any).content?.nav_items?.length ? (seeded as any).content.nav_items : navItems,
    };
    return seeded;
  };
  const openHeaderEditor = () => setEditingHeader(resolveHeader());

  const saveHeader = async (updatedHeader: Block) => {
    const nextData: TemplateDataWithChrome = {
      ...(template.data as TemplateDataWithChrome),
      headerBlock: updatedHeader as Block,
    };
    const next: Template = {
      ...template,
      headerBlock: updatedHeader as any,
      data: nextData as Template['data'],
    };
    setTemplate(next);       // iframe updates instantly
    onChange(next);          // persist
    setEditingHeader(null);  // close panel
  };

  /* block ops */
  function openBlockEditor(blockId?: string | null, blockPath?: string | null) {
    let ref =
      (blockId ? findBlockById(template, blockId) : null) ||
      findBlockByPath(template, blockPath);
    if (!ref && blockId) ref = findBlockById(template, String(blockId));
    if (!ref) return;
    setEditingBlock({ ref });
  }
  function openAdder(blockId?: string | null, blockPath?: string | null) {
    const byPath = findBlockByPath(template, blockPath ?? null);
    const byId = blockId ? findBlockById(template, blockId) : null;
    const ref = byPath ?? byId;
    if (!ref) return;
    setAdderTarget({ pageIdx: ref.pageIdx, insertAt: ref.blockIdx + 1 });
  }
  function handleInsertBlockAt(pageIdx: number, insertAt: number, type: string) {
    const pages = [...getTemplatePages(template)];
    const page = { ...pages[pageIdx] };
    const blocks = [...getPageBlocks(page)];
    const newBlock = createDefaultBlock(type as any) as Block;
    blocks.splice(insertAt, 0, newBlock);
    setPageBlocks(page, blocks);
    pages[pageIdx] = page;
    const nextTemplate: any = Array.isArray((template as any)?.data?.pages)
      ? { ...template, data: { ...(template as any).data, pages } }
      : { ...template, pages };
    setTemplate(nextTemplate);
    onChange(nextTemplate);
    setAdderTarget(null);
  }
  function deleteBlock(blockId?: string | null, blockPath?: string | null) {
    const ref =
      (blockPath ? findBlockByPath(template, blockPath) : null) ??
      (blockId ? findBlockById(template, blockId) : null);
    if (!ref) return;
    const pages = [...getTemplatePages(template)];
    const page = { ...pages[ref.pageIdx] };
    const blocks = [...getPageBlocks(page)];
    blocks.splice(ref.blockIdx, 1);
    setPageBlocks(page, blocks);
    pages[ref.pageIdx] = page;
    const nextTemplate: any = Array.isArray((template as any)?.data?.pages)
      ? { ...template, data: { ...(template as any).data, pages } }
      : { ...template, pages };
    setTemplate(nextTemplate);
    onChange(nextTemplate);
  }
  function saveEditedBlock(updated: Block) {
    const ref = editingBlock?.ref as { pageIdx: number; blockIdx: number; block: Block } | null;
    if (!ref) return;
    const pages = [...getTemplatePages(template)];
    const page = { ...pages[ref.pageIdx] };
    const blocks = [...getPageBlocks(page)];
    blocks[ref.blockIdx] = updated;
    setPageBlocks(page, blocks);
    pages[ref.pageIdx] = page;
    const nextTemplate: any = Array.isArray((template as any)?.data?.pages)
      ? { ...template, data: { ...(template as any).data, pages } }
      : { ...template, pages };
    setTemplate(nextTemplate);
    onChange(nextTemplate);
    setEditingBlock(null);
  }

  /* merge events (favicon/meta) */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as any;
      if (!detail || typeof detail !== 'object') return;
      const next: any = { ...template, ...detail, meta: { ...(template as any)?.meta, ...(detail.meta ?? {}) } };
      setTemplate(next);
      onChange(next);
    };
    window.addEventListener('qs:template:merge', handler as any);
    return () => window.removeEventListener('qs:template:merge', handler as any);
  }, [template, setTemplate, onChange]);

  /* iframe -> parent bus */
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as { type?: string; blockId?: string | null; blockPath?: string | null } | null;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'preview:edit-header') openHeaderEditor();
      else if (d.type === 'preview:edit-block') openBlockEditor(d.blockId ?? null, d.blockPath ?? null);
      else if (d.type === 'preview:add-after') openAdder(d.blockId ?? null, d.blockPath ?? null);
      else if (d.type === 'preview:delete-block') deleteBlock(d.blockId ?? null, d.blockPath ?? null);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [template]);

  /* current page + save handler for page settings */
  const currentPage = useMemo(() => {
    const pages = getTemplatePages(template);
    return pages.find((p: any) => p?.slug === currentPageSlug) ?? pages[0] ?? null;
  }, [template, currentPageSlug]);

  const savePageSettings = (updatedPage: any) => {
    const pages = [...getTemplatePages(template)];
    const idx = pages.findIndex((p: any) => p?.slug === currentPageSlug);
    const targetIdx = idx >= 0 ? idx : 0;

    pages[targetIdx] = { ...pages[targetIdx], ...updatedPage };

    const nextTemplate: any = Array.isArray((template as any)?.data?.pages)
      ? { ...template, data: { ...(template as any).data, pages } }
      : { ...template, pages };

    setTemplate(nextTemplate);  // instant preview update
    onChange(nextTemplate);     // persist
  };

  return (
    <div className="flex min-w-0">
      {/* Left settings */}
      <aside
        className={[
          'fixed z-[1100] inset-y-0 left-0 w-[300px] bg-neutral-950 border-r border-white/10',
          'transform transition-transform duration-200 ease-out',
          showSettings ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="h-full overflow-auto">
          {SidebarSettings ? (
            <SidebarSettings template={template} onChange={(p: any) => onChange(p)} />
          ) : (<div className="p-4 text-sm text-white/70">Loading settings…</div>)}
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/40">
          Press <kbd className="px-1 py-0.5 bg-white/10 rounded">S</kbd> to toggle
        </div>
        <button
          className="fixed bottom-4 left-4 z-[1400] rounded-full p-2 border border-white/10 bg-zinc-900/90 text-white/85 shadow-lg hover:bg-zinc-800"
          onClick={() => setShowSettings(prev => !prev)}
          title={`${showSettings ? 'Hide' : 'Show'} settings (S)`}
        >
          <SettingsIcon size={18} />
        </button>
        <button
          className="xl:hidden absolute top-2 right-2 text-white/70 hover:text-white"
          onClick={() => setShowSettings(false)}
          aria-label="Close"
        >
          ✕
        </button>
      </aside>

      {/* Right: header editor panel + preview */}
      <div className="flex-1 min-w-0 xl:ml-0 ml-0 px-0 lg:px-2">
        {editingHeader && (
          <div className="mb-4 rounded-xl border border-white/10 bg-neutral-950/70 backdrop-blur">
            <PageHeaderEditor
              block={editingHeader}
              onSave={saveHeader}
              onClose={() => setEditingHeader(null)}
              template={template}
              errors={blockErrors}
            />
          </div>
        )}

        <LiveEditorPreviewFrame
          template={template}
          onChange={(t) => onChange(t)}
          errors={blockErrors}
          industry={template.industry}
          templateId={template.id}
          mode={mode}
          rawJson={rawJson}
          setRawJson={setRawJson}
          setTemplate={(t) => setTemplate(t)}
          showEditorChrome
          onEditHeader={openHeaderEditor}
          onRequestEditBlock={(id) => openBlockEditor(id, null)}
          onRequestAddAfter={(id) => openAdder(id, null)}
          previewVersionId={previewVersionId}
          pageSlug={currentPageSlug}
        />
      </div>

      {/* Block editor (modal) */}
      {editingBlock && (
        <div className="fixed inset-0 z-[1200] bg-black/90 p-6 overflow-auto flex items-center justify-center">
          <div className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
            <DynamicBlockEditor
              block={editingBlock.ref!.block}
              onSave={(b: any) => saveEditedBlock(b as Block)}
              onClose={() => setEditingBlock(null)}
              errors={blockErrors}
              template={template}
              colorMode={template?.color_mode || 'dark'}
            />
          </div>
        </div>
      )}

      {/* Block adder */}
      {adderTarget && (
        <div className="fixed inset-0 z-[1200] bg-black/70 p-6 overflow-auto flex items-center justify-center">
          <div className="w-full max-w-3xl bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 text-sm text-white/80">Add a block</div>
            <div className="p-4">
              <BlockAdderGrouped
                existingBlocks={getPageBlocks(getTemplatePages(template)[adderTarget.pageIdx])}
                onAdd={(type: string) => handleInsertBlockAt(adderTarget.pageIdx, adderTarget.insertAt, type)}
                template={template as any}
              />
            </div>
            <div className="p-3 border-t border-white/10 text-right">
              <button
                className="rounded-md px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 text-white"
                onClick={() => setAdderTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom toolbar — portal renders above iframe */}
      <TemplateActionToolbar
        template={template}
        autosaveStatus={autosaveStatus}
        onSaveDraft={(t) => { setTemplate(t!); onChange(t!); }}
        onUndo={() => window.dispatchEvent(new CustomEvent('qs:history:undo'))}
        onRedo={() => window.dispatchEvent(new CustomEvent('qs:history:redo'))}
        onOpenPageSettings={() => setPageSettingsOpen(true)}
        onApplyTemplate={(next) => { setTemplate(next); onChange(next); }}
        onSetRawJson={(json) => setRawJson(json)}
      />


      {/* Page Settings modal */}
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
