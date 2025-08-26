'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

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
  onRequestEditBlock?: (blockId: string) => void;
  onRequestAddAfter?: (blockId: string) => void;

  className?: string;
  style?: React.CSSProperties;

  /** If true and a `qs:preview:save` event is fired, hard reload the iframe */
  reloadOnSave?: boolean;
};

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
  previewVersionId,
  pageSlug,
  className,
  style,
  reloadOnSave = false,
}: Props) {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [loaded, setLoaded] = React.useState(false);

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

  /* ---------------- Build a STABLE iframe src (identifiers only) ---------------- */
  const buildSrc = React.useCallback(() => {
    const qs = new URLSearchParams();
    if (previewVersionId) qs.set('preview_version_id', previewVersionId);
    if (pageSlug) qs.set('page', pageSlug);
    if (templateId) qs.set('template_id', String(templateId));
    if (mode) qs.set('mode', String(mode));
    qs.set('editor', '1');

    const path = pageSlug ? `/preview/${encodeURIComponent(pageSlug)}` : `/preview`;
    return qs.toString() ? `${path}?${qs.toString()}` : path;
  }, [previewVersionId, pageSlug, templateId, mode]);

  const [stableSrc, setStableSrc] = React.useState<string>(() => buildSrc());

  // Only update src when identifiers change
  React.useEffect(() => {
    const next = buildSrc();
    if (next !== stableSrc) setStableSrc(next);
  }, [buildSrc, stableSrc]);

  /* ---------------- Parent → Iframe: send current state ---------------- */
  const postInit = React.useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.postMessage({
        type: 'preview:init',
        template,
        mode,
        pageSlug: pageSlug ?? null,
        templateId: templateId ?? null,
        rawJson: rawJson ?? null,
        industry: industry ?? null,
      }, '*');

      // push current color preference once
      const stored = ((): 'light' | 'dark' => {
        try { return (localStorage.getItem('qs:preview:color') as any) || 'dark'; }
        catch { return 'dark'; }
      })();
      iframe.contentWindow.postMessage({ type: 'preview:set-color-mode', mode: stored }, '*');
    } catch {}
  }, [template, mode, pageSlug, templateId, rawJson, industry]);

  // Init after the iframe finishes loading
  React.useEffect(() => { if (loaded) postInit(); }, [loaded, postInit]);

  // When template content changes, DO NOT reload — just re-send state
  React.useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(postInit, 50);
    return () => clearTimeout(t);
  }, [template, rawJson, postInit, loaded]);

  /* ---------------- Iframe → Parent messages ---------------- */
  React.useEffect(() => {
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
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onChange, setRawJson, setTemplate, onEditHeader, onRequestEditBlock, onRequestAddAfter]);

  /* ---------------- Optional: force reload on explicit "save" event ---------------- */
  React.useEffect(() => {
    const handler = () => {
      if (reloadOnSave) {
        // Small cache-buster to force navigation without changing identifiers
        const buster = stableSrc.includes('?') ? '&_ts=' : '?_ts=';
        setStableSrc(stableSrc + buster + Date.now());
      } else {
        // Soft refresh: just re-post the latest state
        postInit();
      }
    };
    window.addEventListener('qs:preview:save', handler);
    return () => window.removeEventListener('qs:preview:save', handler);
  }, [reloadOnSave, stableSrc, postInit]);

  /* ---------------- Error badge ---------------- */
  const errorCount = React.useMemo(() => {
    if (!errors) return 0;
    if (Array.isArray(errors)) return errors.length;
    if (typeof errors === 'object') return Object.keys(errors).length;
    return 0;
  }, [errors]);

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
                className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-gray-900 shadow hover:bg-white dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
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
        {/* ← stays stable unless identifiers change */}
        <iframe
          ref={iframeRef}
          src={stableSrc}
          className="h-[70vh] w-full rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-black"
          style={{ minHeight: 600 }}
          onLoad={() => setLoaded(true)}
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/5">
          <div className="animate-pulse text-sm text-gray-600 dark:text-gray-300">Loading preview…</div>
        </div>
      )}
    </div>
  );
}
