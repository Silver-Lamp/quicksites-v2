'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import RenderBlock from '@/components/admin/templates/render-block';

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
};

/* ---------------- Helpers ---------------- */
function getPages(t: any) {
  return (t?.data?.pages ?? t?.pages ?? []) as any[];
}

function pageBlocks(p: any) {
  return (p?.blocks ?? p?.content_blocks ?? p?.content?.blocks ?? []) as any[];
}

function getFirstRenderablePage(t: any) {
  const pages = getPages(t);
  if (!Array.isArray(pages) || pages.length === 0) return null;
  return pages.find((p: any) => p.slug === 'index' || p.path === '/') ?? pages[0];
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
    const mode =
      (t.color_mode ??
        t.colorMode ??
        t?.data?.theme?.mode ??
        t?.data?.meta?.mode ??
        t?.meta?.mode ??
        'light') as string;
    return String(mode).toLowerCase() === 'dark' ? 'dark' : 'light';
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

  const blocksRef =
    (selectedPage?.blocks ??
      selectedPage?.content_blocks ??
      selectedPage?.content?.blocks) || [];

  const inlineBlocks = React.useMemo(() => blocksRef, [blocksRef, selectedPage, nonce]);

  const inlineKey = React.useMemo(() => {
    return inlineBlocks
      .map((b: any, i: number) => String(b?._id ?? b?.id ?? `${pageIdx}:${i}`))
      .join('|');
  }, [inlineBlocks, pageIdx, nonce]);

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

  function blockIdOf(b: any, fallback: string) {
    return String(b?._id || b?.id || fallback);
  }

  return (
    <div className={cn('relative w-full', className)} style={{ minHeight: 600, ...style }}>
      {showEditorChrome && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-2">
          <div className="flex items-center gap-2">
            <span className="pointer-events-auto inline-flex items-center rounded-lg bg-black/70 px-2 py-1 text-xs text-white dark:bg-white/10">
              Live Preview {mode ? `· ${mode}` : ''}
            </span>
            {industry ? (
              <span className="pointer-events-auto hidden md:inline-flex items-center rounded-lg bg-black/50 px-2 py-1 text-xs text-white dark:bg-white/10">
                {industry}
              </span>
            ) : null}
            {templateId ? (
              <span className="pointer-events-auto hidden md:inline-flex items-center rounded-lg bg-black/50 px-2 py-1 text-xs text-white dark:bg-white/10">
                id: {String(templateId).slice(0, 8)}…
              </span>
            ) : null}
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {errorCount > 0 && (
              <span className="inline-flex items-center rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white">
                {errorCount} error{errorCount === 1 ? '' : 's'}
              </span>
            )}
            {onEditHeader && (
              <button
                type="button"
                onClick={onEditHeader}
                className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-gray-900 shadow hover:bg-white dark:bg白/10 dark:text-white dark:hover:bg-white/20"
              >
                Edit Global Header, Logo and Favicon
              </button>
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
              // ⬇️ Use min-height so the surface grows with content
              'min-h-[70vh] w-full rounded-lg border transition-colors overflow-visible pb-24',
              siteMode === 'dark'
                ? 'bg-neutral-950 text-neutral-100 border-white/10'
                : 'bg-white text-zinc-900 border-black/10'
            ].join(' ')}
            key={inlineKey}
          >
            <div className="mx-auto max-w-[1100px] p-8 space-y-6">
              {inlineBlocks.length === 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="text-sm text-neutral-400">This page is empty.</div>
                  <button
                    type="button"
                    className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg白/10"
                    onClick={() => onRequestAddAfter?.('__ADD_AT_START__')}
                  >
                    + Add your first block
                  </button>
                </div>
              ) : (
                inlineBlocks.map((b: any, i: number) => {
                  const fallbackPath = `${pageIdx}:${i}`;
                  const id = blockIdOf(b, fallbackPath);

                  const onAnyClick: React.MouseEventHandler = (e) => {
                    const t = e.target as HTMLElement | null;
                    if (!t) return;
                    if (t.closest('a,button,input,label,select,textarea,video')) e.preventDefault();
                    e.stopPropagation();
                    onRequestEditBlock?.(id);
                  };

                  return (
                    <div
                      key={id}
                      className="group relative rounded-lg ring-1 ring-white/5 hover:ring-white/15"
                    >
                      <div className="pointer-events-none absolute -top-3 left-0 right-0 z-10 hidden justify-center gap-2 group-hover:flex">
                        <button
                          type="button"
                          className="pointer-events-auto rounded-md border border-white/20 bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestEditBlock?.(id);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="pointer-events-auto rounded-md border border-red-600 bg-red-600/80 px-2 py-0.5 text-xs text-white hover:bg-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!onRequestDeleteBlock) return;
                            if (confirm('Delete this block?')) onRequestDeleteBlock(id);
                          }}
                        >
                          🗑 Delete
                        </button>
                      </div>

                      <button
                        type="button"
                        className="absolute right-2 top-2 z-10 hidden rounded-md border border-white/20 bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/80 group-hover:block"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestEditBlock?.(id);
                        }}
                      >
                        Edit
                      </button>

                      <div onClickCapture={onAnyClick}>
                        <RenderBlock
                          block={b}
                          blockPath={fallbackPath}
                          previewOnly
                          template={template}
                        />
                      </div>

                      <div className="mt-2 flex justify-center">
                        <button
                          type="button"
                          className="invisible group-hover:visible rounded-md border border-white/15 bg白/5 px-2 py-1 text-xs hover:bg白/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestAddAfter?.(id);
                          }}
                        >
                          + Add block below
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={stableSrc}
            className="h-[70vh] w-full rounded-lg border border黑/10 bg-white dark:border白/10 dark:bg-black"
            style={{ minHeight: 600 }}
            onLoad={() => setLoaded(true)}
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>

      {!useInline && !loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg黑/5 dark:bg白/5">
          <div className="animate-pulse text-sm text-gray-600 dark:text-gray-300">Loading preview…</div>
        </div>
      )}
    </div>
  );
}
