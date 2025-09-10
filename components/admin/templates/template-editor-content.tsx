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

// ✅ centralized block ops (id-based patch helpers)
import {
  insertBlockEmit,
  removeBlockEmit,
  replaceBlockEmit,
  moveBlockEmit,
  // setBlocksEmit // (keep commented until you need bulk ops)
} from '@/components/admin/templates/utils/blocks-patch';

import { Save, Loader2, AlertTriangle, X } from 'lucide-react';

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

// Keeps layout stable when the drawer opens/closes
function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    // Ensure the layout reserves space for the scrollbar at all times
    // so width doesn't change when we toggle overflow.
    html.style.setProperty('scrollbar-gutter', 'stable');

    const prevOverflow = body.style.overflow;
    const prevPadRight = body.style.paddingRight;

    if (locked) {
      // Compensate for the scrollbar width so content doesn't shift horizontally.
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
type PatchOpts = { persist?: boolean }; // default is preview-only

function emitApplyPatch(patch: Partial<Template>, opts: PatchOpts = {}) {
  try {
    const detail = { ...(patch as any), __transient: opts.persist ? false : true };
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail }));
  } catch {}
}

function emitMerge(detail: any) {
  try {
    window.dispatchEvent(new CustomEvent('qs:template:merge', { detail }));
  } catch {}
}

/* ---------- text helpers (props/content mirroring) ---------- */
const TEXT_LIKE = new Set([
  'text', 'rich_text', 'richtext', 'richText', 'paragraph', 'markdown', 'textarea', 'wysiwyg'
]);
function isTextLike(b: any) { return TEXT_LIKE.has(String(b?.type || '').toLowerCase()); }

function firstNonEmptyString(...cands: any[]): string | undefined {
  for (const c of cands) {
    if (typeof c === 'string' && c.trim().length > 0) return c;
  }
  return undefined;
}

// Extract plain text from common rich formats (TipTap/ProseMirror, Quill Delta, arbitrary trees)
function extractRichTextish(v: any): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v.trim().length ? v : undefined;

  // Quill delta { ops: [{ insert: '...' }, ...] }
  if (Array.isArray(v?.ops)) {
    const s = v.ops.map((op: any) => (typeof op?.insert === 'string' ? op.insert : '')).join('');
    return s.trim().length ? s : undefined;
  }

  // ProseMirror/TipTap: recursively collect node.text
  const collectPM = (node: any): string => {
    if (!node) return '';
    if (typeof node.text === 'string') return node.text;
    const kids = Array.isArray(node.content) ? node.content : Array.isArray(node.children) ? node.children : [];
    return kids.map(collectPM).join('');
  };
  const pm = collectPM(v);
  if (pm.trim().length) return pm;

  // Generic arrays/objects
  if (Array.isArray(v)) {
    const s = v.map(extractRichTextish).filter(Boolean).join(' ');
    return s.trim().length ? s : undefined;
  }
  if (typeof v === 'object') {
    const s = [v.text, v.value, v.html, v.body, v.markdown]
      .map(extractRichTextish)
      .filter(Boolean)
      .join(' ');
    return s.trim().length ? s : undefined;
  }
  return undefined;
}

/** Mirror text/html/value across props & content so BOTH readers are satisfied. */
function mirrorTextPropsAndContent<T extends Block | any>(b: T): T {
  if (!b || !isTextLike(b)) return b;

  const root    = (b as any) ?? {};
  const props   = { ...(b as any).props } as any;
  const content = { ...(b as any).content } as any;

  // 1) Try direct strings first
  let chosen =
    firstNonEmptyString(
      root.html, root.text, typeof root.value === 'string' ? root.value : undefined,
      props.html, props.text, typeof props.value === 'string' ? props.value : undefined,
      content.html, content.text, typeof content.value === 'string' ? content.value : undefined,
      // markdown/body common aliases
      props.markdown, content.markdown, props.body, content.body
    );

  // 2) Fallback to structured text (json/doc/delta)
  if (!chosen) {
    chosen =
      extractRichTextish(props.json)   || extractRichTextish(content.json)   ||
      extractRichTextish(props.doc)    || extractRichTextish(content.doc)    ||
      extractRichTextish(props.delta)  || extractRichTextish(content.delta)  ||
      undefined;
  }

  const canon = (chosen ?? '').toString();

  props.html = canon;  content.html = canon;
  props.text = canon;  content.text = canon;
  props.value = canon; content.value = canon;

  if (!content.format) content.format = 'html';

  const out: any = { ...(b as any), props, content };
  delete out.html; delete out.text; delete out.value;

  return out as T;
}


/** Normalize ALL text-like blocks in a data object */
function normalizeDataTextShapes(data: any): any {
  const srcPages = Array.isArray(data?.pages) ? data.pages : [];
  const pagesOut = srcPages.map((p: any) => {
    const pageCopy: any = { ...p };
    const blocks = getPageBlocks(pageCopy);
    if (!Array.isArray(blocks) || blocks.length === 0) return pageCopy;
    const mirrored = blocks.map((b: any) => mirrorTextPropsAndContent(b));
    setPageBlocks(pageCopy, mirrored);
    return pageCopy;
  });
  return { ...(data ?? {}), pages: pagesOut };
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
  const emitPatchIfAllowed = (patch: Partial<Template>, opts: PatchOpts = {}) => {
    if (suppressEmitRef.current) return;
    emitApplyPatch(patch, opts);
  };

  const editMuteRef = useRef(false);
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
  // Keep body scroll locked when the settings drawer is open (no layout shift)
  useBodyScrollLock(showSettings);

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
      localStorage.removeItem('qs:newtemplate:welcome:dismissed:new');
    } catch {}

    setShowWelcome(false);

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
      // Esc closes the modal when open
      if (key === 'escape' && showSettings) {
        e.preventDefault();
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', onKey, { capture: true, passive: false });
    return () => window.removeEventListener('keydown', onKey as any, { capture: true } as any);
  }, [showSettings]);

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
    applyDataAndBroadcast(nextData as any, { headerBlock: updatedHeader as any });
    setEditingHeader(null);
  };

  /* block ops */
  function openBlockEditor(blockId?: string | null, blockPath?: string | null) {
    if (editMuteRef.current) return;

    let ref =
      (blockId ? findBlockById(template, blockId) : null) ??
      findBlockByPath(template, blockPath);
    if (!ref && blockId && /^\d+:\d+$/.test(blockId)) {
      ref = findBlockByPath(template, blockId);
    }
    if (!ref) return;

    const t = (ref.block as any)?.type;
    if (t === 'hours') {
      openHoursSettingsPanel(setShowSettings);
      return;
    }

    const normalized = mirrorTextPropsAndContent(ref.block);

    editMuteRef.current = true;
    setEditingBlock({ ref: { ...ref, block: normalized } });
  }

  function openAdder(blockId?: string | null, blockPath?: string | null) {
    if (blockId === '__ADD_AT_START__') {
      const pages = getTemplatePages(template);
      let pageIdx = pages.findIndex((p: any) => p?.slug === currentPageSlug);
      if (pageIdx < 0) pageIdx = 0;
      setAdderTarget({ pageIdx, insertAt: 0 });
      return;
    }

    let ref =
      (blockPath ? findBlockByPath(template, blockPath) : null) ??
      (blockId ? findBlockById(template, blockId) : null);
    if (!ref && blockId && /^\d+:\d+$/.test(blockId)) {
      ref = findBlockByPath(template, blockId);
    }
    if (!ref) return;

    setAdderTarget({ pageIdx: ref.pageIdx, insertAt: ref.blockIdx + 1 });
  }

  function moveBlock(
    blockId?: string | null,
    blockPath?: string | null,
    toIndex?: number
  ) {
    if (toIndex == null || Number.isNaN(Number(toIndex))) return;
    captureHistory();

    let ref =
      (blockPath ? findBlockByPath(template, blockPath) : null) ??
      (blockId ? findBlockById(template, blockId) : null);
    if (!ref && blockId && /^\d+:\d+$/.test(blockId)) {
      ref = findBlockByPath(template, blockId);
    }
    if (!ref) return;

    const pages = getTemplatePages(template);
    const page = pages[ref.pageIdx];
    const pageKey = String(page?.id ?? page?.slug ?? page?.path ?? ref.pageIdx);

    const beforeArr =
      (page?.blocks ??
        page?.content_blocks ??
        page?.content?.blocks ??
        []) as Block[];

    const realId =
      (ref.block as any)?._id ?? (ref.block as any)?.id ?? null;

    let nextData: any | undefined;

    if (realId) {
      nextData = moveBlockEmit(
        template,
        pageKey,
        String(realId),
        Number(toIndex)
      );
    }

    const emitterNoOp =
      !nextData ||
      !Array.isArray(nextData?.pages) ||
      (() => {
        const p = nextData.pages[ref!.pageIdx];
        const afterArr =
          (p?.blocks ?? p?.content_blocks ?? p?.content?.blocks ?? []) as Block[];
        if (afterArr.length !== beforeArr.length) return false;
        const sig = (a: Block[]) =>
          a.map((b, i) => String((b as any)?._id ?? (b as any)?.id ?? `${i}`)).join('|');
        return sig(afterArr) === sig(beforeArr);
      })();

    if (emitterNoOp) {
      const pagesOut = pages.map((p, i) => {
        if (i !== ref!.pageIdx) return p;
        const copy: any = { ...p };
        const arr =
          (copy?.blocks ??
            copy?.content_blocks ??
            copy?.content?.blocks ??
            []) as Block[];
        const next = Array.from(arr);
        const from = ref!.blockIdx;
        const clamped = Math.max(0, Math.min(Number(toIndex), next.length - 1));
        const [item] = next.splice(from, 1);
        next.splice(clamped, 0, item);
        setPageBlocks(copy, next);
        return copy;
      });
      nextData = Array.isArray((template as any)?.data?.pages)
        ? { ...(template as any).data, pages: pagesOut }
        : { pages: pagesOut };
    }

    if (nextData) {
      applyDataAndBroadcast(nextData);
    }
  }

  function deleteBlock(blockId?: string | null, blockPath?: string | null) {
    captureHistory();

    let ref =
      (blockPath ? findBlockByPath(template, blockPath) : null) ??
      (blockId ? findBlockById(template, blockId) : null);
    if (!ref && blockId && /^\d+:\d+$/.test(blockId)) {
      ref = findBlockByPath(template, blockId);
    }
    if (!ref) return;

    const pages = getTemplatePages(template);
    const page = pages[ref.pageIdx];
    const pageKey = String(page?.id ?? page?.slug ?? page?.path ?? ref.pageIdx);

    const beforeArr =
      (page?.blocks ??
        page?.content_blocks ??
        page?.content?.blocks ??
        []) as Block[];

    const realId = (ref.block as any)?._id ?? (ref.block as any)?.id ?? null;
    let nextData: any | undefined;

    if (realId) {
      nextData = removeBlockEmit(template, pageKey, String(realId));
    }

    const noChangeViaEmitter =
      !nextData ||
      !Array.isArray(nextData?.pages) ||
      (() => {
        const p = nextData.pages[ref!.pageIdx];
        const afterArr =
          (p?.blocks ?? p?.content_blocks ?? p?.content?.blocks ?? []) as Block[];
        return afterArr.length === beforeArr.length;
      })();

    if (noChangeViaEmitter) {
      const pagesOut = pages.map((p, i) => {
        if (i !== ref!.pageIdx) return p;
        const copy: any = { ...p };
        const arr =
          (copy?.blocks ??
            copy?.content_blocks ??
            copy?.content?.blocks ??
            []) as Block[];
        const next = arr.filter((_, idx) => idx !== ref!.blockIdx);
        setPageBlocks(copy, next);
        return copy;
      });

      nextData = Array.isArray((template as any)?.data?.pages)
        ? { ...(template as any).data, pages: pagesOut }
        : { pages: pagesOut };
    }

    if (nextData) {
      applyDataAndBroadcast(nextData);
    }
  }

  function handleInsertBlockAt(
    pageIdx: number,
    insertAt: number,
    type: string,
    opts?: { openEditor?: boolean }
  ) {
    captureHistory();

    const makeId = () =>
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

    const baseBlock = createDefaultBlock(type as any) as Block;
    const insertedId =
      (baseBlock as any)._id ?? (baseBlock as any).id ?? makeId();
    const withId = { ...(baseBlock as any), _id: insertedId } as Block;
    const withIdMirrored = mirrorTextPropsAndContent(withId);

    const pages = getTemplatePages(template);
    const page = pages[pageIdx];
    const pageKey = String(page?.id ?? page?.slug ?? page?.path ?? pageIdx);

    const beforeArr =
      (page?.blocks ??
        page?.content_blocks ??
        page?.content?.blocks ??
        []) as Block[];

    const emitted = insertBlockEmit(template, pageKey, withIdMirrored, insertAt);
    let nextData: any | undefined = emitted?.nextData;

    const emitterNoOp =
      !nextData ||
      !Array.isArray(nextData?.pages) ||
      (() => {
        const p = nextData.pages[pageIdx];
        const afterArr =
          (p?.blocks ?? p?.content_blocks ?? p?.content?.blocks ?? []) as Block[];
        return afterArr.length !== beforeArr.length + 1;
      })();

    if (emitterNoOp) {
      const pagesOut = pages.map((p, i) => {
        if (i !== pageIdx) return p;
        const copy: any = { ...p };
        const arr =
          (copy?.blocks ??
            copy?.content_blocks ??
            copy?.content?.blocks ??
            []) as Block[];
        const next = Array.from(arr);
        const at = Math.max(0, Math.min(insertAt, next.length));
        next.splice(at, 0, withIdMirrored);
        setPageBlocks(copy, next);
        return copy;
      });
      nextData = Array.isArray((template as any)?.data?.pages)
        ? { ...(template as any).data, pages: pagesOut }
        : { pages: pagesOut };
    }

    if (nextData) {
      applyDataAndBroadcast(nextData);
    }
    setAdderTarget(null);

    if (opts?.openEditor) {
      if ((withIdMirrored as any).type === 'hours') {
        openHoursSettingsPanel(setShowSettings);
      } else {
        const p = nextData?.pages?.[pageIdx];
        const arr =
          (p?.blocks ?? p?.content_blocks ?? p?.content?.blocks ?? []) as any[];
        const idx = Math.max(
          0,
          arr.findIndex((b) => String(b?._id ?? b?.id) === String(insertedId))
        );
        setEditingBlock({
          ref: { pageIdx, blockIdx: idx >= 0 ? idx : insertAt, block: withIdMirrored },
        });
      }
    }
  }

  function saveEditedBlock(updated: Block) {
    captureHistory();

    const ref = editingBlock?.ref as { pageIdx: number; blockIdx: number; block: Block } | null;
    const curAny = (ref?.block ?? {}) as any;
    const updAny = (updated as any);

    const curId = curAny._id ?? curAny.id ?? null;
    if (curId && updAny._id == null && updAny.id == null) {
      updAny._id = curId;
    }

    const normalizedUpdated = mirrorTextPropsAndContent(updAny as Block);

    let nextData = replaceBlockEmit(template, normalizedUpdated);

    const emitterNoOp = !nextData || !Array.isArray(nextData?.pages);
    if (emitterNoOp && ref) {
      const pages = [...getTemplatePages(template)];
      const page = { ...pages[ref.pageIdx] };
      const blocks = [...getPageBlocks(page)];
      const idx = Math.max(0, Math.min(ref.blockIdx, blocks.length - 1));
      blocks[idx] = normalizedUpdated;
      setPageBlocks(page, blocks);
      pages[ref.pageIdx] = page;
      nextData = Array.isArray((template as any)?.data?.pages)
        ? { ...(template as any).data, pages }
        : { pages };
    }

    if (nextData) {
      applyDataAndBroadcast(nextData);
    }

    setEditingBlock(null);
    editMuteRef.current = false;
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
        onViewDiff={() => {}}
      />
    );
  }

  // keep data/pages in sync + notify preview iframe (MERGE, don't overwrite)
  const applyDataAndBroadcast = (nextData: any, extra?: Partial<Template>) => {
    const prevData = (template as any)?.data ?? {};
    const mergedData = { ...prevData, ...(nextData ?? {}) };
    if (Array.isArray(nextData?.pages)) mergedData.pages = nextData.pages;

    const nextTemplate: any = { ...template, ...(extra ?? {}), data: mergedData };
    nextTemplate.pages = mergedData.pages;

    setTemplate(nextTemplate);
    onChange(nextTemplate);
    emitPatchIfAllowed({
      data: nextTemplate.data,
      pages: nextTemplate.pages,
      ...(extra?.headerBlock ? { headerBlock: extra.headerBlock as any } : {}),
      ...(extra?.footerBlock ? { footerBlock: extra.footerBlock as any } : {}),
    });
  };

  return (
    <div className="relative flex min-w-0 w-full [scrollbar-gutter:stable]">
      {showWelcome && <NewTemplateWelcome onStart={dismissWelcome} />}

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
          onChange={(t) => {
            const normalized = {
              ...t,
              data: normalizeDataTextShapes((t as any).data ?? {}),
            };
            setTemplate(normalized);
            onChange(normalized);
            emitPatchIfAllowed({
              data: (normalized as any).data,
              headerBlock: (normalized as any).headerBlock,
              footerBlock: (normalized as any).footerBlock,
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
          onRequestDeleteBlock={(id) => deleteBlock(id, null)}
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


      {/* SETTINGS AS MODAL DRAWER */}
      {showSettings && (
        <div
          className="fixed inset-0 z-[1300] bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-y-0 right-0 w-[min(92vw,1000px)] max-w-[1000px] h-full shadow-2xl">
            <div className="h-full bg-neutral-900 border-l border-white/10 flex flex-col">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-3 border-b border-white/10 bg-neutral-900/95 backdrop-blur">
                <div className="text-sm text-white/80">
                  <strong>Template Settings</strong>
                  <span className="ml-2 text-white/40 text-[10px]">
                    (Press <kbd className="px-1 py-0.5 rounded bg-white/10">S</kbd> to close)
                  </span>
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
                  {/* History panel stays inline */}
                  {template.id && (
                    <div className="mt-3 w-full">
                      <CollapsiblePanel
                        id="truth-tracker"
                        key={`truth-tracker-${true ? 'open' : 'closed'}`}
                        title={<span className="flex items-center gap-2"><span>History</span></span>}
                        defaultOpen={false}
                        lazyMount
                        onOpenChange={() => {}}
                      >
                        {({ open }) => (!open ? null : <TruthTrackerPanel templateId={template.id} />)}
                      </CollapsiblePanel>
                    </div>
                  )}

                  <SidebarSettings
                    template={template}
                    onChange={(p: any) => onChange(p)}
                    variant="drawer"           // <-- makes it fill the modal
                  />
                  </>
                ) : (
                  <div className="p-4 text-sm text-white/70">Loading settings…</div>
                )}
              </div>
            </div>
          </div>

          {/* Click-away area */}
          <button
            aria-label="Close settings"
            className="absolute inset-0 left-0 right-[min(92vw,1000px)]"
            onClick={() => setShowSettings(false)}
          />
        </div>
      )}

      {/* Bottom toolbar */}
      <TemplateActionToolbar
        template={template}
        autosaveStatus={autosaveStatus}
        onSaveDraft={(t) => {
          const normalized = { ...(t as any), data: normalizeDataTextShapes((t as any).data ?? {}) };
          setTemplate(normalized as any);
          onChange(normalized as any);
          emitPatchIfAllowed({ template_name: (t as any).template_name, data: (normalized as any).data }, { persist: true });
        }}
        onUndo={undo}
        onRedo={redo}
        onOpenPageSettings={() => setPageSettingsOpen(true)}
        onApplyTemplate={applyFromToolbar}
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
