'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import RenderBlock from '@/components/admin/templates/render-block';
import { Pencil, Trash2, GripVertical } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// dnd-kit
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { flushSync } from 'react-dom';
import { createDefaultBlock } from '@/lib/createDefaultBlock'; // ⬅️ fallback insert

type Mode = 'view' | 'edit' | 'preview' | string;

type Props = {
  template: any;
  onChange?: (next: any) => void;
  errors?: Record<string, any> | null;

  /** shown in chrome badge only; NOT in URL to avoid reloads */
  industry?: string | null;

  /** identifiers (safe in URL) */
  templateId?: string | null;
  previewVersionId?: string | null;
  pageSlug?: string | null;

  mode?: Mode;

  rawJson?: string;
  setRawJson?: (v: string) => void;
  setTemplate?: (t: any) => void;

  showEditorChrome?: boolean;
  onEditHeader?: () => void;

  /** Open the editor for a specific block id */
  onRequestEditBlock?: (blockId: string) => void;
  /** Add block after a specific block id (or special "__ADD_AT_START__") */
  onRequestAddAfter?: (blockId: string) => void;
  /** Delete a block by id */
  onRequestDeleteBlock?: (blockId: string) => void;

  className?: string;
  style?: React.CSSProperties;

  /** If true and a `qs:preview:save` event is fired, hard reload the iframe */
  reloadOnSave?: boolean;

  /** Force inline (no iframe) for fresh/remixed templates */
  preferInlinePreview?: boolean;
  device?: 'mobile' | 'tablet' | 'desktop';
};

/* ---------------- Helpers ---------------- */
function getPages(t: any) {
  return (t?.data?.pages ?? t?.pages ?? []) as any[];
}
function getFirstRenderablePage(t: any) {
  const pages = getPages(t);
  if (!Array.isArray(pages) || pages.length === 0) return null;
  return pages.find((p: any) => p.slug === 'index' || p.path === '/') ?? pages[0];
}
function blockIdOf(b: any, fallback: string) {
  return String(b?._id || b?.id || fallback);
}

// Accessor to read/write blocks, mirroring between blocks/content_blocks if both exist.
// Also returns the primary patchPath (prefers content_blocks) so the patch pipeline is consistent.
function getBlocksAccessor(template: any, pageIdx: number) {
  const hasDataPages = Array.isArray(template?.data?.pages);
  const pages = getPages(template);
  const page = pages?.[pageIdx] ?? {};
  const prefix = hasDataPages ? '/data/pages' : '/pages';

  const hasBlocks = Array.isArray(page.blocks);
  const hasContentBlocks = Array.isArray(page.content_blocks);

  const get = () => {
    if (hasContentBlocks) return page.content_blocks as any[];
    if (hasBlocks) return page.blocks as any[];
    return page?.content?.blocks ?? [];
  };

  const set = (nextBlocks: any[]) => {
    const next = { ...(template || {}) };
    const pagesCopy = pages.slice();
    const nextPage = { ...page };

    // Write to whichever exists; if both exist, keep them mirrored.
    if (hasContentBlocks) nextPage.content_blocks = nextBlocks;
    if (hasBlocks) nextPage.blocks = nextBlocks;

    // Fallback when neither array is present
    if (!hasContentBlocks && !hasBlocks) {
      nextPage.content = { ...(page.content || {}), blocks: nextBlocks };
    }

    pagesCopy[pageIdx] = nextPage;
    if (hasDataPages) next.data = { ...(next.data || {}), pages: pagesCopy };
    else next.pages = pagesCopy;

    // Primary path prefers content_blocks
    const patchPath = hasContentBlocks
      ? `${prefix}/${pageIdx}/content_blocks`
      : hasBlocks
        ? `${prefix}/${pageIdx}/blocks`
        : `${prefix}/${pageIdx}/content/blocks`;

    return { nextTemplate: next, patchPath };
  };

  return { get, set, prefix, hasBlocks, hasContentBlocks, page };
}

/* ---------- NEW: header/footer resolution helpers (robust to naming) ---------- */

function boolish(v: any, fallback: boolean) {
  return typeof v === 'boolean' ? v : fallback;
}

// “Use custom header/footer on this page” — we accept a few possible keys.
function pageWantsCustomHF(page: any) {
  return !!(
    page?.use_custom_header_footer ??
    page?.useCustomHeaderFooter ??
    page?.custom_header_footer ??
    page?.use_custom ??
    page?.useCustom ??
    false
  );
}

// Try several common keys for header/footer blocks on page and template.
function resolveHeaderBlock(template: any, page: any) {
  if (pageWantsCustomHF(page)) {
    const pageHeader =
      page?.custom_header_block ??
      page?.page_header_block ??
      page?.header_block ??
      page?.customHeaderBlock ??
      page?.pageHeaderBlock ??
      page?.headerBlock ??
      page?.custom_header ??
      page?.header ??
      null;
    if (pageHeader) return pageHeader;
  }
  return (
    template?.headerBlock ??
    template?.header_block ??
    template?.data?.headerBlock ??
    template?.data?.header ??
    template?.header ??
    null
  );
}

function resolveFooterBlock(template: any, page: any) {
  if (pageWantsCustomHF(page)) {
    const pageFooter =
      page?.custom_footer_block ??
      page?.page_footer_block ??
      page?.footer_block ??
      page?.customFooterBlock ??
      page?.pageFooterBlock ??
      page?.footerBlock ??
      page?.custom_footer ??
      page?.footer ??
      null;
    if (pageFooter) return pageFooter;
  }
  return (
    template?.footerBlock ??
    template?.footer_block ??
    template?.data?.footerBlock ??
    template?.data?.footer ??
    template?.footer ??
    null
  );
}

/* ======================================================================= */

export default function LiveEditorPreviewFrame({
  template,
  onChange,
  errors,
  industry,
  templateId,
  mode = 'preview',
  rawJson,
  setRawJson,
  setTemplate,
  showEditorChrome = true,
  onEditHeader,
  onRequestEditBlock,
  onRequestAddAfter,
  onRequestDeleteBlock,
  previewVersionId,
  pageSlug,
  className,
  style,
  reloadOnSave = false,
  preferInlinePreview = false,
  device,
}: Props) {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  // Forces recompute when editor emits any template patch (transient or persisted)
  const [nonce, setNonce] = React.useState(0);
  React.useEffect(() => {
    const bump = () => setNonce((n) => n + 1);
    window.addEventListener('qs:template:apply-patch', bump as any);
    return () => window.removeEventListener('qs:template:apply-patch', bump as any);
  }, []);

  // Site color mode
  const siteMode: 'light' | 'dark' = React.useMemo(() => {
    const t: any = template || {};
    const m =
      (t.color_mode ??
        t.colorMode ??
        t?.data?.theme?.mode ??
        t?.data?.meta?.mode ??
        t?.meta?.mode ??
        'light') as string;
    return String(m).toLowerCase() === 'dark' ? 'dark' : 'light';
  }, [template]);

  /* ---------------- Viewport wrapper (visual only; never in URL) ---------------- */
  const [viewport, setViewport] = React.useState<'mobile' | 'tablet' | 'desktop'>(() => {
    try { return (localStorage.getItem('qs:preview:viewport') as any) || 'desktop'; }
    catch { return 'desktop'; }
  });

  React.useEffect(() => {
    const onViewport = (e: Event) => {
      const detail = (e as CustomEvent).detail as 'mobile' | 'tablet' | 'desktop';
      if (!detail) return;
      setViewport(detail);
      try { localStorage.setItem('qs:preview:viewport', detail); } catch {}
    };
    const onColor = (e: Event) => {
      const m = (e as CustomEvent).detail as 'light' | 'dark';
      try {
        iframeRef.current?.contentWindow?.postMessage({ type: 'preview:set-color-mode', mode: m }, '*');
        localStorage.setItem('qs:preview:color', m);
      } catch {}
    };
    window.addEventListener('qs:preview:set-viewport', onViewport as any);
    window.addEventListener('qs:preview:set-color-mode', onColor as any);
    return () => {
      window.removeEventListener('qs:preview:set-viewport', onViewport as any);
      window.removeEventListener('qs:preview:set-color-mode', onColor as any);
    };
  }, []);

  const widthPx =
    viewport === 'mobile' ? 390 :
    viewport === 'tablet' ? 768 :
    undefined; // desktop full

  /* ---------------- Decide whether to inline or iframe ---------------- */
  const preferInlineAuto = !template?.is_site && !previewVersionId;
  const useInline = preferInlinePreview || preferInlineAuto;

  /* ---------------- Local slug (follows prop + listens to events) ---------------- */
  const [localSlug, setLocalSlug] = React.useState<string | null>(pageSlug ?? null);
  React.useEffect(() => setLocalSlug(pageSlug ?? null), [pageSlug]);

  React.useEffect(() => {
    const onSelect = (e: Event) => {
      const slug = (e as CustomEvent).detail?.slug as string | undefined;
      if (slug) setLocalSlug(slug);
    };
    window.addEventListener('qs:page:select', onSelect as any);
    return () => window.removeEventListener('qs:page:select', onSelect as any);
  }, []);

  const slugForView = localSlug ?? pageSlug ?? null;

  /* ---------------- Inline selection + blocks (nonce-aware) ---------------- */
  const pagesForIndex = React.useMemo(() => getPages(template), [template, nonce]);

  const selectedPage = React.useMemo(() => {
    const pages = pagesForIndex;
    if (!Array.isArray(pages) || pages.length === 0) return null;
    if (slugForView) {
      const found =
        pages.find((p: any) => p.slug === slugForView) ||
        pages.find((p: any) => p.path === `/${slugForView}`);
      if (found) return found;
    }
    return getFirstRenderablePage({ data: { pages } });
  }, [pagesForIndex, slugForView, nonce]);

  const pageIdx = React.useMemo(() => {
    if (!selectedPage) return 0;
    const bySlug = slugForView
      ? pagesForIndex.findIndex(
          (p: any) => p?.slug === slugForView || p?.path === `/${slugForView}`
        )
      : -1;
    if (bySlug >= 0) return bySlug;
    const byRef = pagesForIndex.indexOf(selectedPage);
    return byRef >= 0 ? byRef : 0;
  }, [pagesForIndex, selectedPage, slugForView, nonce]);

  // Prefer reading from content_blocks, then blocks, then content.blocks
  const baseBlocks =
    (selectedPage?.content_blocks ??
     selectedPage?.blocks ??
     selectedPage?.content?.blocks) || [];

  // --- Optimistic blocks for instant UI after DnD/delete ---
  const [optimisticBlocks, setOptimisticBlocks] = React.useState<any[] | null>(null);

  // Only reset on true template/page changes (not every patch)
  React.useEffect(() => {
    setOptimisticBlocks(null);
  }, [template, pageIdx, slugForView]); // ← deliberately no `nonce`

  const renderBlocks = (optimisticBlocks ?? baseBlocks) as any[];

  const ids = React.useMemo(
    () => renderBlocks.map((b: any, i: number) => blockIdOf(b, `${pageIdx}:${i}`)),
    [renderBlocks, pageIdx]
  );

  /* ---------------- Build a STABLE iframe src (identifiers only) ---------------- */
  const buildSrc = React.useCallback(() => {
    const qs = new URLSearchParams();
    if (previewVersionId) qs.set('preview_version_id', previewVersionId);
    if (slugForView) qs.set('page', slugForView);
    if (templateId) qs.set('template_id', String(templateId));
    if (mode) qs.set('mode', String(mode));
    qs.set('editor', '1');

    const path = slugForView ? `/preview/${encodeURIComponent(slugForView)}` : `/preview`;
    return qs.toString() ? `${path}?${qs.toString()}` : path;
  }, [previewVersionId, slugForView, templateId, mode]);

  const [stableSrc, setStableSrc] = React.useState<string>(() => buildSrc());

  React.useEffect(() => {
    if (useInline) return;
    const next = buildSrc();
    if (next !== stableSrc) setStableSrc(next);
  }, [buildSrc, stableSrc, useInline]);

  /* ---------------- Parent → Iframe: send current state ---------------- */
  const postInit = React.useCallback(() => {
    if (useInline) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(
        {
          type: 'preview:init',
          template,
          mode,
          pageSlug: slugForView ?? null,
          templateId: templateId ?? null,
          rawJson: rawJson ?? null,
          industry: industry ?? null,
        },
        '*'
      );

      const stored = ((): 'light' | 'dark' => {
        try { return (localStorage.getItem('qs:preview:color') as any) || 'dark'; }
        catch { return 'dark'; }
      })();
      iframe.contentWindow.postMessage({ type: 'preview:set-color-mode', mode: stored }, '*');
    } catch {}
  }, [template, mode, slugForView, templateId, rawJson, industry, useInline]);

  React.useEffect(() => { if (!useInline && loaded) postInit(); }, [loaded, postInit, useInline]);

  React.useEffect(() => {
    if (useInline) return;
    if (!loaded) return;
    const t = setTimeout(postInit, 50);
    return () => clearTimeout(t);
  }, [template, rawJson, postInit, loaded, useInline]);

  /* ---------------- Iframe → Parent messages ---------------- */
  React.useEffect(() => {
    if (useInline) return;
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'preview:change') {
        onChange?.(data.payload);
        if (setRawJson && typeof data.payload?.rawJson === 'string') setRawJson(data.payload.rawJson);
        if (setTemplate && data.payload?.template) setTemplate(data.payload.template);
      } else if (data.type === 'preview:edit-header') {
        onEditHeader?.();
      } else if (data.type === 'preview:edit-block' && data.blockId) {
        onRequestEditBlock?.(String(data.blockId));
      } else if (data.type === 'preview:add-after' && data.blockId) {
        onRequestAddAfter?.(String(data.blockId));
      } else if (data.type === 'preview:delete-block' && data.blockId) {
        onRequestDeleteBlock?.(String(data.blockId));
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onChange, setRawJson, setTemplate, onEditHeader, onRequestEditBlock, onRequestAddAfter, onRequestDeleteBlock, useInline]);

  /* ---------------- Optional: force reload on explicit "save" event ---------------- */
  React.useEffect(() => {
    if (useInline) return;
    const handler = () => {
      if (reloadOnSave) {
        const buster = stableSrc.includes('?') ? '&_ts=' : '?_ts=';
        setStableSrc(stableSrc + buster + Date.now());
      } else {
        postInit();
      }
    };
    window.addEventListener('qs:preview:save', handler);
    return () => window.removeEventListener('qs:preview:save', handler);
  }, [reloadOnSave, stableSrc, postInit, useInline]);

  /* ---------------- Error badge ---------------- */
  const errorCount = React.useMemo(() => {
    if (!errors) return 0;
    if (Array.isArray(errors)) return errors.length;
    if (typeof errors === 'object') return Object.keys(errors).length;
    return 0;
  }, [errors]);

  /* ---------------- Patch mirroring listener (set both arrays) ---------------- */
  React.useEffect(() => {
    const onPatch = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      if (!detail || detail._fromMirror) return;

      const path = String(detail.path || '');
      // Match /data/pages/{i}/blocks or /pages/{i}/content_blocks
      const m = path.match(/^\/(data\/pages|pages)\/(\d+)\/(blocks|content_blocks)$/);
      if (!m) return;

      const pageIdxFromPatch = Number(m[2]);
      const key = m[3] as 'blocks' | 'content_blocks';
      const siblingKey = key === 'blocks' ? 'content_blocks' : 'blocks';

      // Only mirror if both arrays exist on that page
      const pages = getPages(template);
      const pg = pages?.[pageIdxFromPatch];
      if (!pg) return;
      if (!Array.isArray((pg as any)[key]) || !Array.isArray((pg as any)[siblingKey])) return;

      const siblingPath = path.replace(/\/(blocks|content_blocks)$/, `/${siblingKey}`);

      // Emit mirrored patch with guard to prevent loops (reuse provided value if present)
      window.dispatchEvent(new CustomEvent('qs:template:apply-patch', {
        detail: { ...detail, path: siblingPath, _fromMirror: true }
      }));
    };

    window.addEventListener('qs:template:apply-patch', onPatch as any);
    return () => window.removeEventListener('qs:template:apply-patch', onPatch as any);
  }, [template]);

  /* ---------------- dnd-kit setup ---------------- */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Reorder (optimistic), then emit canonical set patch; include full data for commit builder.
  const applyReorder = React.useCallback(
    (from: number, to: number) => {
      const accessor = getBlocksAccessor(template, pageIdx);
      const current = (optimisticBlocks ?? accessor.get()) as any[];
      if (!Array.isArray(current) || from === to || from < 0 || to < 0) return;

      const nextBlocks = arrayMove(current, from, to);

      // 1) Optimistic UI
      setOptimisticBlocks(nextBlocks);

      // 2) Update parent template immediately so commit builder reads fresh data
      const { nextTemplate, patchPath } = accessor.set(nextBlocks);
      flushSync(() => {
        setTemplate?.(nextTemplate);
      });

      // 3) Emit canonical patch (global listener mirrors if needed)
      try {
        window.dispatchEvent(new CustomEvent('qs:template:apply-patch', {
          detail: {
            op: 'set',
            path: patchPath,
            value: nextBlocks,
            // Provide fresh data in case the commit builder prefers detail over reading state
            data: nextTemplate?.data,
            headerBlock: nextTemplate?.headerBlock,
            footerBlock: nextTemplate?.footerBlock,
            template_name: nextTemplate?.template_name,
          }
        }));
      } catch {}
    },
    [template, pageIdx, optimisticBlocks, setTemplate]
  );

  // Delete (optimistic), then emit canonical set patch; include full data for commit builder.
  const applyDeleteAt = React.useCallback(
    (idx: number) => {
      const accessor = getBlocksAccessor(template, pageIdx);
      const current = (optimisticBlocks ?? accessor.get()) as any[];
      if (!Array.isArray(current) || idx < 0 || idx >= current.length) return;

      const nextBlocks = current.slice(0, idx).concat(current.slice(idx + 1));

      setOptimisticBlocks(nextBlocks);

      const { nextTemplate, patchPath } = accessor.set(nextBlocks);
      flushSync(() => {
        setTemplate?.(nextTemplate);
      });

      try {
        window.dispatchEvent(new CustomEvent('qs:template:apply-patch', {
          detail: {
            op: 'set',
            path: patchPath,
            value: nextBlocks,
            data: nextTemplate?.data,
            headerBlock: nextTemplate?.headerBlock,
            footerBlock: nextTemplate?.footerBlock,
            template_name: nextTemplate?.template_name,
          }
        }));
      } catch {}
    },
    [template, pageIdx, optimisticBlocks, setTemplate]
  );

  const onDragStart = React.useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);
  const onDragEnd = React.useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    applyReorder(from, to);
  }, [ids, applyReorder]);

  /* ---------------- NEW: show header/footer for the current page ---------------- */
  const showHeader = React.useMemo(
    () => boolish(selectedPage?.show_header ?? selectedPage?.showHeader, true),
    [selectedPage]
  );
  const showFooter = React.useMemo(
    () => boolish(selectedPage?.show_footer ?? selectedPage?.showFooter, true),
    [selectedPage]
  );

  const headerBlock = React.useMemo(
    () => (selectedPage && showHeader ? resolveHeaderBlock(template, selectedPage) : null),
    [template, selectedPage, showHeader]
  );
  const footerBlock = React.useMemo(
    () => (selectedPage && showFooter ? resolveFooterBlock(template, selectedPage) : null),
    [template, selectedPage, showFooter]
  );

  /* ---------------- helper: SAFELY add first block ---------------- */
  const safeAddFirstBlock = React.useCallback(() => {
    // If the host passed a handler, use it.
    if (typeof onRequestAddAfter === 'function') {
      onRequestAddAfter('__ADD_AT_START__');
      return;
    }

    // Fallback: insert a default Hero block directly into page state
    try {
      const accessor = getBlocksAccessor(template, pageIdx);
      const current = (optimisticBlocks ?? accessor.get()) as any[];
      const hero = createDefaultBlock('hero') as any;
      const nextBlocks = [hero, ...current];

      setOptimisticBlocks(nextBlocks);
      const { nextTemplate, patchPath } = accessor.set(nextBlocks);
      flushSync(() => setTemplate?.(nextTemplate));

      window.dispatchEvent(new CustomEvent('qs:template:apply-patch', {
        detail: {
          op: 'set',
          path: patchPath,
          value: nextBlocks,
          data: nextTemplate?.data,
          headerBlock: nextTemplate?.headerBlock,
          footerBlock: nextTemplate?.footerBlock,
          template_name: nextTemplate?.template_name,
        }
      }));
    } catch (err) {
      console.error('Add-first-block failed:', err);
    }
  }, [onRequestAddAfter, template, pageIdx, optimisticBlocks, setTemplate]);

  /* ---------------- Render ---------------- */
  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn('relative w-full', className)} style={{ minHeight: 600, ...style }}>
        {showEditorChrome && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-2">
            <div className="flex items-center gap-2">
              {industry ? (
                <span className="pointer-events-auto hidden md:inline-flex items-center rounded-lg bg-black/50 px-2 py-1 text-xs text-white dark:bg-white/10">
                  {industry}
                </span>
              ) : null}
            </div>

            <div className="pointer-events-auto flex items-center gap-2 mt-[-70px] mr-[30px]">
              {errorCount > 0 && (
                <span className="inline-flex items-center rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white">
                  {errorCount} error{errorCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Width wrapper centers the preview and controls width without reloading */}
        <div
          className="mx-auto transition-all duration-150"
          style={{ width: widthPx ? `${widthPx}px` : '100%', maxWidth: '100%' }}
        >
          {useInline ? (
            <div
              className={[
                'min-h-[70vh] w-full rounded-lg border transition-colors overflow-visible pb-24',
                siteMode === 'dark'
                  ? 'bg-neutral-950 text-neutral-100 border-white/10'
                  : 'bg-white text-zinc-900 border-black/10'
              ].join(' ')}
            >
              <div className="mx-auto max-w-[1100px] p-8 space-y-6">
                {/* NEW: Header (not draggable) */}
                {headerBlock && (
                  <div>
                    <RenderBlock
                      block={headerBlock}
                      blockPath="/header"
                      previewOnly
                      template={template}
                      device={viewport}
                    />
                  </div>
                )}

                {renderBlocks.length === 0 ? (
                  <div className="flex flex-col items-center gap-3" style={{ pointerEvents: 'auto' }}>
                    <div className="text-sm text-neutral-400">This page is empty.</div>
                    <button
                      id="qs-add-first-block"                           // ← diagnostic handle
                      type="button"
                      className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
                      onPointerDownCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); safeAddFirstBlock(); }}
                    >
                      + Add your first block
                    </button>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  >
                    <SortableContext
                      items={ids}
                      strategy={verticalListSortingStrategy}
                      key={ids.join('|')} // force clean re-render after reorder
                    >
                      {renderBlocks.map((b: any, i: number) => {
                        const id = ids[i];

                        return (
                          <SortableRow
                            key={id}
                            id={id}
                            isActive={activeId === id}
                            onEdit={() => onRequestEditBlock?.(id)}
                            onDelete={() => {
                              applyDeleteAt(i);             // optimistic + patch
                              onRequestDeleteBlock?.(id);   // keep your side-effects
                            }}
                          >
                            {/* Click-anywhere-to-edit, except on interactive elements */}
                            <div
                              onClickCapture={(e) => {
                                if (activeId) return; // ignore while dragging
                                const t = e.target as HTMLElement | null;
                                if (!t) return;
                                if (t.closest('a,button,input,label,select,textarea,video')) e.preventDefault();
                                e.stopPropagation();
                                onRequestEditBlock?.(id);
                              }}
                            >
                              <RenderBlock
                                block={b}
                                blockPath={`${pageIdx}:${i}`}
                                previewOnly
                                template={template}
                                device={viewport}
                              />
                            </div>

                            <div className="mt-2 flex justify-center">
                              <button
                                type="button"
                                className="invisible group-hover:visible rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRequestAddAfter?.(id);
                                }}
                              >
                                + Add block below
                              </button>
                            </div>
                          </SortableRow>
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                )}

                {/* NEW: Footer (not draggable) */}
                {footerBlock && (
                  <div>
                    <RenderBlock
                      block={footerBlock}
                      blockPath="/footer"
                      previewOnly
                      template={template}
                      device={viewport}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={stableSrc}
              className="h-[70vh] w-full rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-black"
              style={{ minHeight: 600 }}
              onLoad={() => setLoaded(true)}
              loading="eager"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
        </div>

        {!useInline && !loaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/5">
            <div className="animate-pulse text-sm text-gray-600 dark:text-gray-300">Loading preview…</div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

/* ===================== Sortable Row ===================== */

function SortableRow({
  id,
  isActive,
  onEdit,
  onDelete,
  children,
}: {
  id: string;
  isActive?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes /* role/aria; keeps keyboard semantics if you add KeyboardSensor later */}
      className={cn(
        'group relative rounded-lg ring-1 ring-white/5 hover:ring-white/15',
        (isDragging || isActive) && 'opacity-70'
      )}
    >
      {/* Top-right controls: Drag handle + Edit + Delete */}
      <div className="pointer-events-none absolute right-2 top-2 z-10 hidden gap-1 group-hover:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            {/* DRAG HANDLE — listeners go ONLY here to enforce handle-only dragging */}
            <button
              type="button"
              aria-label="Drag to reorder"
              className="pointer-events-auto inline-flex items-center rounded-md border border-white/20 bg-black/60 p-1.5 text-white hover:bg-black/80 cursor-grab active:cursor-grabbing"
              {...listeners}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" align="center">
            Drag to reorder
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Edit block"
              className="pointer-events-auto inline-flex items-center rounded-md border border-white/20 bg-black/60 px-1.5 py-1.5 text-white hover:bg-black/80"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
            >
              <Pencil className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" align="center">
            Edit block
          </TooltipContent>
        </Tooltip>

        {!!onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Delete block"
                className="pointer-events-auto inline-flex items-center rounded-md border border-red-600 bg-red-600/80 p-1.5 text-white hover:bg-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" align="center">
              Delete block
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {children}
    </div>
  );
}
