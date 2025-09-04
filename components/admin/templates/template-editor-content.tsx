// components/admin/templates/template-editor-content.tsx
'use client';

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
  useRef,
} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Template, TemplateData } from '@/types/template';
import type { Block } from '@/types/blocks';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';

import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor';
import LiveEditorPreviewFrame from '@/components/editor/live-editor/LiveEditorPreviewFrame';
// import { Settings as SettingsIcon } from 'lucide-react';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import PageHeaderEditor from '@/components/admin/templates/block-editors/header-editor';
import { TemplateActionToolbar } from '@/components/admin/templates/template-action-toolbar';
import PageSettingsModal from '@/components/admin/templates/page-settings-modal';
import { useTruthTrackerState } from './hooks/useTruthTrackerState';
import TemplateTruthTracker from './sidebar/TemplateTruthTracker';
import NewTemplateWelcome from '@/components/admin/templates/NewTemplateWelcome';
import CollapsiblePanel from '@/components/ui/collapsible-panel';

// ✅ centralized block ops
import {
  insertBlockEmit,
  removeBlockEmit,
  replaceBlockEmit,
  moveBlockEmit,
  // setBlocksEmit // (import later if you wire reordering/bulk)
} from '@/components/admin/templates/utils/blocks-patch';

const SidebarSettings = dynamic(
  () => import('@/components/admin/template-settings-panel/sidebar-settings'),
  { ssr: false }
);

type TemplateDataWithChrome = TemplateData & {
  headerBlock?: Block | null;
  footerBlock?: Block | null;
};

// global.d.ts
declare global {
  interface WindowEventMap {
    'qs:open-settings-panel': CustomEvent<{
      panel: 'hours';
      openEditor?: boolean;
      scroll?: boolean;
      spotlightMs?: number;
    }>;
  }
}
export {};

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
  if (Array.isArray(p?.blocks)) { p.blocks = blocks; wrote = true; }
  if (Array.isArray(p?.content_blocks)) { p.content_blocks = blocks; wrote = true; }
  if (Array.isArray(p?.content?.blocks)) { p.content = { ...(p.content ?? {}), blocks }; wrote = true; }
  if (!wrote) { p.content = { ...(p?.content ?? {}), blocks }; }
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
      if (String(bid) === String(id))
        return { pageIdx: p, blockIdx: b, block: blocks[b] };
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
  return {
    pageIdx: parsed.pageIdx,
    blockIdx: parsed.blockIdx,
    block: blocks[parsed.blockIdx],
  };
}

// 🔎 helper: find first block of a given type across pages
function findFirstBlockOfType(tpl: Template, type: string) {
  const pages = getTemplatePages(tpl);
  for (let p = 0; p < pages.length; p++) {
    const blocks = getPageBlocks(pages[p]);
    for (let b = 0; b < blocks.length; b++) {
      const blk: any = blocks[b];
      if (String(blk?.type) === type) return { pageIdx: p, blockIdx: b, block: blocks[b] };
    }
  }
  return null;
}

function openHoursSettingsPanel(setShowSettings: (open: boolean) => void) {
  setShowSettings(true);
  requestAnimationFrame(() => {
    window.dispatchEvent(
      new CustomEvent('qs:open-settings-panel', {
        detail: {
          panel: 'hours',
          openEditor: true,
          scroll: true,
          spotlightMs: 900,
        } as any,
      })
    );
  });
}

/* ---------- event helpers (fix recursion bug) ---------- */
function emitApplyPatch(patch: Partial<Template>) {
  try {
    window.dispatchEvent(
      new CustomEvent('qs:template:apply-patch', { detail: patch as any })
    );
  } catch {}
}
function emitMerge(detail: any) {
  try {
    window.dispatchEvent(
      new CustomEvent('qs:template:merge', { detail })
    );
  } catch {}
}

/* ---------- component ---------- */
type Props = {
  template: Template;
  rawJson: string;
  setRawJson: Dispatch<SetStateAction<string>>;
  livePreviewData: TemplateData; // (not used here, keep for API parity)
  setTemplate: Dispatch<SetStateAction<Template>>;
  autosaveStatus?: string;
  setShowPublishModal?: (open: boolean) => void;
  recentlyInsertedBlockId?: string | null; // (not used)
  setBlockErrors: (errors: Record<string, BlockValidationError[]>) => void;
  blockErrors: Record<string, BlockValidationError[]>;
  mode: 'template' | 'site';
  onChange: (patch: Partial<Template>) => void;
};

export default function EditorContent({
  template,
  rawJson,
  setRawJson,
  livePreviewData, // eslint-disable-line @typescript-eslint/no-unused-vars
  setTemplate,
  autosaveStatus,
  setShowPublishModal,
  recentlyInsertedBlockId, // eslint-disable-line @typescript-eslint/no-unused-vars
  setBlockErrors,
  blockErrors,
  mode,
  onChange,
}: Props) {
  // --- Undo/Redo history (template-level) ---
  const deepClone = (o: any) => JSON.parse(JSON.stringify(o));
  const pastRef = useRef<Template[]>([]);
  const futureRef = useRef<Template[]>([]);
  const applyingRef = useRef(false);

  // Re-emit suppression to prevent toolbar↔editor loops
  const suppressEmitRef = useRef(false);
  const emitPatchIfAllowed = (patch: Partial<Template>) => {
    if (suppressEmitRef.current) return;
    emitApplyPatch(patch);
  };

  const editMuteRef = useRef(false); // prevent re-entrant block editor openings
  const editingKeyRef = useRef<string | null>(null);
  const lastEditEvtRef = useRef<{ key: string; ts: number } | null>(null);

  // apply invoked by toolbar (do not re-broadcast)
  const applyFromToolbar = (next: Template) => {
    suppressEmitRef.current = true;
    setTemplate(next);
    onChange(next);
    setTimeout(() => {
      suppressEmitRef.current = false;
    }, 0);
  };

  const captureHistory = useMemo(
    () => () => {
      if (applyingRef.current) return;
      pastRef.current.push(deepClone(template));
      futureRef.current = [];
    },
    [template]
  );

  const applySnapshot = (snap: Template) => {
    applyingRef.current = true;
    setTemplate(snap);
    onChange(snap);
    emitPatchIfAllowed({
      data: (snap as any).data,
      headerBlock: (snap as any).headerBlock,
      footerBlock: (snap as any).footerBlock,
    });
    applyingRef.current = false;
  };

  const undo = useMemo(
    () => () => {
      if (!pastRef.current.length) return;
      futureRef.current.push(deepClone(template));
      const prev = pastRef.current.pop()!;
      applySnapshot(prev);
    },
    [template]
  );

  const redo = useMemo(
    () => () => {
      if (!futureRef.current.length) return;
      pastRef.current.push(deepClone(template));
      const next = futureRef.current.pop()!;
      applySnapshot(next);
    },
    [template]
  );

  useEffect(() => {
    const h = (e: Event) => setShowSettings(!!(e as CustomEvent).detail);
    window.addEventListener('qs:settings:set-open', h as any);
    return () => window.removeEventListener('qs:settings:set-open', h as any);
  }, []);

  // Allow toolbar (or others) to ask for capture/undo/redo
  useEffect(() => {
    const cap = () => captureHistory();
    const u = () => undo();
    const r = () => redo();
    window.addEventListener('qs:history:capture', cap as any);
    window.addEventListener('qs:history:undo', u as any);
    window.addEventListener('qs:history:redo', r as any);
    return () => {
      window.removeEventListener('qs:history:capture', cap as any);
      window.removeEventListener('qs:history:undo', u as any);
      window.removeEventListener('qs:history:redo', r as any);
    };
  }, [captureHistory, undo, redo]);

  // Keyboard: ⌘Z / ⇧⌘Z (when not typing)
  useEffect(() => {
    const isTyping = (n: EventTarget | null) => {
      const el = n as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = (el.tagName || '').toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        !!el.closest?.('.cm-editor,.ProseMirror')
      );
    };
    const onKey = (e: KeyboardEvent) => {
      const k = (e.key || '').toLowerCase();
      if (!(e.metaKey || e.ctrlKey) || k !== 'z') return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey as any, { capture: true } as any);
  }, [undo, redo]);

  const searchParams = useSearchParams();
  const previewVersionId = searchParams.get('preview_version_id');
  const tab = (searchParams.get('tab') ?? 'blocks') as 'blocks' | 'live';
  const currentPageSlug = useMemo(
    () => searchParams.get('page') ?? firstPageSlug(template),
    [searchParams, template]
  );

  const [showSettings, setShowSettings] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);

  // header panel above preview
  const [editingHeader, setEditingHeader] = useState<Block | null>(null);

  // non-header block modal
  const [editingBlock, setEditingBlock] = useState<{
    ref:
      | ReturnType<typeof findBlockById>
      | ReturnType<typeof findBlockByPath>
      | null;
  } | null>(null);

  // block adder
  const [adderTarget, setAdderTarget] = useState<null | {
    pageIdx: number;
    insertAt: number;
  }>(null);

  // first-run splash (brand new templates)
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Brand-new if rev===0 OR template has no pages/blocks
    const pages = getTemplatePages(template);
    const first = pages[0] ?? null;
    const firstBlocks = first ? (getPageBlocks(first) ?? []) : [];
    const isBrandNewByRev =
      Number(((template as any)?.rev ?? (template as any)?.data?.rev ?? 0)) === 0;
    const isBrandNewByShape = pages.length === 0 || firstBlocks.length === 0;
    const isBrandNew = isBrandNewByRev || isBrandNewByShape;

    if (!isBrandNew) {
      setShowWelcome(false);
      return;
    }

    // Use id→canonical_id→slug for dismissal key (avoid the old 'new' bucket)
    const tid =
      (template as any)?.id ??
      (template as any)?.canonical_id ??
      (template as any)?.slug ??
      'new';
    const key = `qs:newtemplate:welcome:dismissed:${tid}`;

    try {
      const seen = localStorage.getItem(key) === '1';
      setShowWelcome(!seen);
    } catch {
      setShowWelcome(true);
    }
  }, [(template as any)?.id, (template as any)?.canonical_id, (template as any)?.slug, (template as any)?.rev]);

  const dismissWelcome = () => {
    const tid =
      (template as any)?.id ??
      (template as any)?.canonical_id ??
      (template as any)?.slug ??
      'new';
    const key = `qs:newtemplate:welcome:dismissed:${tid}`;
    try {
      localStorage.setItem(key, '1');
      // Optional: clear old global 'new' bucket so future templates aren’t blocked
      localStorage.removeItem('qs:newtemplate:welcome:dismissed:new');
    } catch {}
  
    setShowWelcome(false);
  
    // Open first Hero if present; else open Header
    setTimeout(() => {
      const ref = findFirstBlockOfType(template, 'hero');
      if (ref?.block) {
        const id = (ref.block as any)?._id ?? (ref.block as any)?.id ?? '';
        openBlockEditor(id, `${ref.pageIdx}:${ref.blockIdx}`);
      } else {
        openHeaderEditor();
      }
    }, 60);
  };
  

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
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (n as HTMLInputElement).type === 'text';
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
          setShowSettings((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', onKey, { capture: true, passive: false });
    return () => window.removeEventListener('keydown', onKey as any, { capture: true } as any);
  }, []);

  // keep a ref to the currently-edited block and last edit event
  useEffect(() => {
    const k = editingBlock?.ref
      ? `${editingBlock.ref.pageIdx}:${editingBlock.ref.blockIdx}`
      : null;
    editingKeyRef.current = k;
  }, [editingBlock]);

  /* header editor wiring */
  const resolveHeader = (): Block => {
    const existing =
      (template as any)?.data?.headerBlock ||
      (template as any)?.headerBlock ||
      null;
    if (existing?.type === 'header') return existing as Block;

    const seeded = createDefaultBlock('header') as Block;
    const navItems =
      getTemplatePages(template)
        .slice(0, 5)
        .map((p: any) => ({ label: p.title || p.slug, href: `/${p.slug}` })) ?? [];
    (seeded as any).content = {
      ...(seeded as any).content,
      nav_items: (seeded as any).content?.nav_items?.length
        ? (seeded as any).content.nav_items
        : navItems,
    };
    return seeded;
  };
  const openHeaderEditor = () => setEditingHeader(resolveHeader());

  const saveHeader = async (updatedHeader: Block) => {
    captureHistory();
    const nextData: TemplateDataWithChrome = {
      ...(template.data as TemplateDataWithChrome),
      headerBlock: updatedHeader as Block,
    };
    const next: Template = {
      ...template,
      headerBlock: updatedHeader as any,
      data: nextData as Template['data'],
    };
    setTemplate(next);
    onChange(next);
    // do not emit patch here — toolbar will handle persistence via other broadcasts
    setEditingHeader(null);
  };

  /* block ops */
  function openBlockEditor(blockId?: string | null, blockPath?: string | null) {
    if (editMuteRef.current) return; // already editing
    let ref =
      (blockId ? findBlockById(template, blockId) : null) ||
      findBlockByPath(template, blockPath);
    if (!ref && blockId) ref = findBlockById(template, String(blockId));
    if (!ref) return;

    const t = (ref.block as any)?.type;
    if (t === 'hours') {
      openHoursSettingsPanel(setShowSettings);
      return;
    }

    editMuteRef.current = true; // mute further edit intents
    setEditingBlock({ ref });
  }

  function openAdder(blockId?: string | null, blockPath?: string | null) {
    // Special case: empty page CTA from LiveEditorPreviewFrame
    if (blockId === '__ADD_AT_START__') {
      // Use current page if possible; otherwise the first renderable page
      const pages = getTemplatePages(template);
      let pageIdx = pages.findIndex((p: any) => p?.slug === currentPageSlug);
      if (pageIdx < 0) pageIdx = 0; // safe fallback
  
      // Insert at the very beginning of the page
      setAdderTarget({ pageIdx, insertAt: 0 });
      return;
    }
  
    // Existing behavior: add below an existing block
    const byPath = findBlockByPath(template, blockPath ?? null);
    const byId = blockId ? findBlockById(template, blockId) : null;
    const ref = byPath ?? byId;
    if (!ref) return;
    setAdderTarget({ pageIdx: ref.pageIdx, insertAt: ref.blockIdx + 1 });
  }
  

  function handleInsertBlockAt(
    pageIdx: number,
    insertAt: number,
    type: string,
    opts?: { openEditor?: boolean }
  ) {
    captureHistory();

    // create a block (id optional; util will ensure one)
    const newBlock = createDefaultBlock(type as any) as Block;

    // derive a stable page id/slug for the util
    const pages = getTemplatePages(template);
    const page = pages[pageIdx];
    const pageKey = String(page?.id ?? page?.slug ?? page?.path ?? pageIdx);

    // centralized insert + emit
    const result = insertBlockEmit(template, pageKey, newBlock, insertAt);

    // reflect into local template state
    if (result?.nextData) {
      const nextTemplate: any = { ...template, data: result.nextData };
      if (!Array.isArray(nextTemplate.pages)) nextTemplate.pages = result.nextData.pages;
      setTemplate(nextTemplate);
      onChange(nextTemplate);
    }

    setAdderTarget(null);

    if (opts?.openEditor && result?.block) {
      if ((result.block as any).type === 'hours') {
        openHoursSettingsPanel(setShowSettings);
      } else {
        setEditingBlock({
          ref: { pageIdx, blockIdx: insertAt, block: result.block },
        });
      }
    }
  }

  function moveBlock(blockId?: string | null, blockPath?: string | null, toIndex?: number) {
    if (toIndex == null || Number.isNaN(Number(toIndex))) return;
    captureHistory();
  
    // Find the block (by id or path)
    const ref =
      (blockPath ? findBlockByPath(template, blockPath) : null) ??
      (blockId ? findBlockById(template, blockId) : null);
    if (!ref) return;
  
    // Page identity for the util
    const pages = getTemplatePages(template);
    const page = pages[ref.pageIdx];
    const pageKey = String(page?.id ?? page?.slug ?? page?.path ?? ref.pageIdx);
  
    // Centralized move + emit (updates working copy via events)
    const nextData = moveBlockEmit(
      template,
      pageKey,
      String(blockId ?? (ref.block as any)?._id),
      Number(toIndex)
    );
  
    // Reflect into local state so UI stays in lockstep
    if (nextData) {
      const nextTemplate: any = { ...template, data: nextData };
      if (!Array.isArray(nextTemplate.pages)) nextTemplate.pages = nextData.pages;
      setTemplate(nextTemplate);
      onChange(nextTemplate);
    }
  }
  
  function deleteBlock(blockId?: string | null, blockPath?: string | null) {
    captureHistory();
    const ref =
      (blockPath ? findBlockByPath(template, blockPath) : null) ??
      (blockId ? findBlockById(template, blockId) : null);
    if (!ref) return;

    const pages = getTemplatePages(template);
    const page = pages[ref.pageIdx];
    const pageKey = String(page?.id ?? page?.slug ?? page?.path ?? ref.pageIdx);

    const nextData = removeBlockEmit(template, pageKey, String(blockId ?? (ref.block as any)?._id));
    if (nextData) {
      const nextTemplate: any = { ...template, data: nextData };
      if (!Array.isArray(nextTemplate.pages)) nextTemplate.pages = nextData.pages;
      setTemplate(nextTemplate);
      onChange(nextTemplate);
    }
  }

  function saveEditedBlock(updated: Block) {
    captureHistory();

    // centralized replace + emit
    const nextData = replaceBlockEmit(template, updated);

    if (nextData) {
      const nextTemplate: any = { ...template, data: nextData };
      if (!Array.isArray(nextTemplate.pages)) nextTemplate.pages = nextData.pages;
      setTemplate(nextTemplate);
      onChange(nextTemplate);
    } else {
      // fallback (shouldn't happen): manual in-place replace
      const ref = editingBlock?.ref as {
        pageIdx: number;
        blockIdx: number;
        block: Block;
      } | null;
      if (ref) {
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
        emitPatchIfAllowed({ data: { ...(nextTemplate as any).data, pages }, pages });
      }
    }

    setEditingBlock(null);
    editMuteRef.current = false; // unmute
  }

  /* merge events (favicon/meta) */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as any;
      if (!detail || typeof detail !== 'object') return;
      const next: any = {
        ...template,
        ...detail,
        meta: { ...(template as any)?.meta, ...(detail.meta ?? {}) },
      };
      setTemplate(next);
      onChange(next);
      // broadcast only specific bits (meta + any chrome)
      const patch: Partial<Template> = {
        ...(detail.headerBlock ? { headerBlock: detail.headerBlock } : {}),
        ...(detail.footerBlock ? { footerBlock: detail.footerBlock } : {}),
        data: {
          ...(next.data ?? {}),
          ...(detail.meta ? { meta: detail.meta } : {}),
        } as any,
      };
      emitPatchIfAllowed(patch);
    };
    window.addEventListener('qs:template:merge', handler as any);
    return () => window.removeEventListener('qs:template:merge', handler as any);
  }, [template, setTemplate, onChange]);

  /* iframe -> parent bus */
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as {
        type?: string;
        blockId?: string | null;
        blockPath?: string | null;
      } | null;
      if (!d || typeof d !== 'object') return;

      // ignore edit intents while a modal is open
      if (
        editMuteRef.current &&
        (d.type === 'preview:edit-block' || d.type === 'preview:edit-header')
      ) {
        return;
      }

      if (d.type === 'preview:edit-header') {
        openHeaderEditor();
        return;
      }

      if (d.type === 'preview:edit-block') {
        // dedupe + debounce
        const key = `${d.blockId ?? ''}|${d.blockPath ?? ''}`;
        const now = performance.now();
        const last = lastEditEvtRef.current;

        if (editingKeyRef.current) {
          const samePath =
            typeof d.blockPath === 'string' &&
            d.blockPath === editingKeyRef.current;
          const sameId =
            typeof d.blockId === 'string' &&
            (editingBlock?.ref?.block as any)?._id === d.blockId;
          if (samePath || sameId) return;
        }
        if (last && last.key === key && now - last.ts < 500) return;
        lastEditEvtRef.current = { key, ts: now };

        openBlockEditor(d.blockId ?? null, d.blockPath ?? null);
        return;
      }

      if (d.type === 'preview:add-after') {
        openAdder(d.blockId ?? null, d.blockPath ?? null);
        return;
      }
      if (d.type === 'preview:delete-block') {
        deleteBlock(d.blockId ?? null, d.blockPath ?? null);
        return;
      }
      if (d.type === 'preview:move-block') {
        // expects: { type:'preview:move-block', blockId?, blockPath?, toIndex:number }
        moveBlock(d.blockId ?? null, d.blockPath ?? null, (d as any).toIndex);
        return;
      }      
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [openHeaderEditor, openBlockEditor, openAdder, deleteBlock, editingBlock, moveBlock]);

  /* current page + save handler for page settings */
  const currentPage = useMemo(() => {
    const pages = getTemplatePages(template);
    return pages.find((p: any) => p?.slug === currentPageSlug) ?? pages[0] ?? null;
  }, [template, currentPageSlug]);

  const savePageSettings = (updatedPage: any) => {
    captureHistory();
    const pages = [...getTemplatePages(template)];
    const idx = pages.findIndex((p: any) => p?.slug === currentPageSlug);
    const targetIdx = idx >= 0 ? idx : 0;
    pages[targetIdx] = { ...pages[targetIdx], ...updatedPage };

    const nextTemplate: any = Array.isArray((template as any)?.data?.pages)
      ? { ...template, data: { ...(template as any).data, pages } }
      : { ...template, pages };

    setTemplate(nextTemplate);
    onChange(nextTemplate);
    emitPatchIfAllowed({ data: { ...(nextTemplate as any).data, pages }, pages });
  };

  /* ---------- Tabs: Blocks (default) | Live (iframe) ---------- */
  const pathname = usePathname();
  const buildTabHref = (which: 'blocks' | 'live') => {
    const qp = new URLSearchParams(searchParams ?? undefined);
    qp.set('tab', which);
    return `${pathname}?${qp.toString()}`;
  };

  const preferInlinePreview = useMemo(() => tab !== 'live', [tab]);


  function TruthTrackerPanel({ templateId }: { templateId: string }) {
    const { state, loading, error, reload } = useTruthTrackerState(templateId);
    if (loading || !state) return null;
    const { infra, snapshots, versions, events, adminMeta } = state;
  
    return (
      <TemplateTruthTracker
        templateId={templateId}
        infra={infra}
        snapshots={snapshots}
        versions={versions}
        events={events}
        selectedSnapshotId={infra?.lastSnapshot?.id}
        adminMeta={adminMeta}
        onRefresh={reload}
        // onCreateSnapshot={async () => { await createSnapshot(templateId); await reload(); }}
        // onPublish={async (sid) => { await publishSnapshot(templateId, sid); await reload(); }}
        onViewDiff={() => {}}
      />
    );
  }
  

  return (
    <div className="flex min-w-0">
      {showWelcome && <NewTemplateWelcome onStart={dismissWelcome} />}

      {/* Right: header editor panel + preview */}
      <div className="flex-1 min-w-0 xl:ml-0 ml-0 px-0 lg:px-2">
        {/* Tabs */}
        <div className="flex gap-2 border-b border白/10 mb-3 px-2 pt-2">
          <Link
            href={buildTabHref('blocks')}
            className={[
              'px-4 py-2 text-sm rounded-t-md border-b-2 transition-colors',
              tab === 'blocks'
                ? 'border-white/80 text-white'
                : 'border-transparent text-white/60 hover:text-white',
            ].join(' ')}
            prefetch={false}
          >
            Blocks
          </Link>
        <Link
            href={buildTabHref('live')}
            className={[
              'px-4 py-2 text-sm rounded-t-md border-b-2 transition-colors',
              tab === 'live'
                ? 'border-white/80 text-white'
                : 'border-transparent text-white/60 hover:text-white',
            ].join(' ')}
            prefetch={false}
          >
            Live
          </Link>
        </div>

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
          onChange={(t) => {
            setTemplate(t);
            onChange(t);
            emitPatchIfAllowed({
              data: (t as any).data,
              headerBlock: (t as any).headerBlock,
              footerBlock: (t as any).footerBlock,
            });
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
          onEditHeader={openHeaderEditor}
          onRequestEditBlock={(id) => openBlockEditor(id, null)}
          onRequestAddAfter={(id) => openAdder(id, null)}
          onRequestDeleteBlock={(id) => deleteBlock(id, null)}  // delete wired
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
              onSave={(b: any) => {
                saveEditedBlock(b as Block);
                editMuteRef.current = false;
              }}
              onClose={() => {
                setEditingBlock(null);
                editMuteRef.current = false;
              }}
              errors={blockErrors}
              template={template}
              colorMode={template?.color_mode || 'dark'}
            />
          </div>
        </div>
      )}

      {/* Block adder */}
      {adderTarget && (
        <div className="fixed inset-0 z-[1200] bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="mx-auto max-w-4xl pt-[12vh] px-4 pb-12">
            <div className="w-full rounded-xl border border-white/10 bg-neutral-900 shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10 text-sm text-white/80">
                Add a block
              </div>

              <div className="p-2 sm:p-4">
                <BlockAdderGrouped
                  inline
                  showOnlyQuickPicks
                  startCollapsed
                  existingBlocks={
                    getPageBlocks(getTemplatePages(template)[adderTarget.pageIdx])
                  }
                  onAdd={(type: string) =>
                    handleInsertBlockAt(
                      adderTarget.pageIdx,
                      adderTarget.insertAt,
                      type
                    )
                  }
                  onAddAndEdit={(type: string) =>
                    handleInsertBlockAt(
                      adderTarget.pageIdx,
                      adderTarget.insertAt,
                      type,
                      { openEditor: true }
                    )
                  }
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
        </div>
      )}

    {template.id && (
    <>
      <div className="mt-3">
        <CollapsiblePanel
          id="truth-tracker"
          key={`truth-tracker-${true ? 'open' : 'closed'}`}
          title={
            <span className="flex items-center gap-2">
              <span>History</span>
              {/* <span className="text-[10px] text-white/40">(press <kbd className="px-1 py-0.5 rounded bg-white/10">S</kbd> to toggle)</span> */}
            </span>
          }
          defaultOpen={false}
          lazyMount
          onOpenChange={() => {}}
       >
        {({ open }) => (
          !open ? null : (
        <TruthTrackerPanel templateId={template.id} />
          )
        )}
       </CollapsiblePanel>
        <CollapsiblePanel
          id="editor-settings"
          /* key forces the panel to re-init with defaultOpen on S toggle */
          key={`settings-${showSettings ? 'open' : 'closed'}`}
          title={
            <span className="flex items-center gap-2">
              <span>Template Settings</span>
              <span className="text-[10px] text-white/40">(press <kbd className="px-1 py-0.5 rounded bg-white/10">S</kbd> to toggle)</span>
            </span>
          }
          defaultOpen={showSettings}
          lazyMount
          onOpenChange={setShowSettings}
       >
         {SidebarSettings ? (
           <SidebarSettings
             template={template}
             onChange={(p: any) => onChange(p)}
             />
           ) : (
             <div className="p-4 text-sm text-white/70">Loading settings…</div>
           )}
         </CollapsiblePanel>
         </div>
       </>
    )}

      {/* Bottom toolbar */}
      <TemplateActionToolbar
        template={template}
        autosaveStatus={autosaveStatus}
        onSaveDraft={(t) => {
          setTemplate(t!);
          onChange(t!);
          emitPatchIfAllowed({ data: (t as any).data });
        }}
        onUndo={undo}
        onRedo={redo}
        onOpenPageSettings={() => setPageSettingsOpen(true)}
        onApplyTemplate={applyFromToolbar} // prevents re-emit loop
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
