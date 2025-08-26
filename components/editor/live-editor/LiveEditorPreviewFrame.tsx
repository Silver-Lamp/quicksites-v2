'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type Mode = 'view' | 'edit' | 'preview' | string;

type Props = {
  template: any;
  onChange?: (next: any) => void;
  errors?: Record<string, any> | null;
  industry?: string | null;
  templateId?: string | null;
  mode?: Mode;

  rawJson?: string;
  setRawJson?: (v: string) => void;
  setTemplate?: (t: any) => void;

  showEditorChrome?: boolean;
  onEditHeader?: () => void;
  onRequestEditBlock?: (blockId: string) => void;
  onRequestAddAfter?: (blockId: string) => void;

  previewVersionId?: string | null;
  pageSlug?: string | null;

  className?: string;
  style?: React.CSSProperties;
};

export default function LiveEditorPreviewFrame(props: Props) {
  const {
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
  } = props;

  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  // Preview viewport (purely visual: never reload the iframe)
  const [viewport, setViewport] = React.useState<'mobile' | 'tablet' | 'desktop'>(() => {
    try {
      return (localStorage.getItem('qs:preview:viewport') as any) || 'desktop';
    } catch {
      return 'desktop';
    }
  });

  // Listen for toolbar events (viewport & color mode) and forward color to iframe
  React.useEffect(() => {
    const onViewport = (e: Event) => {
      const detail = (e as CustomEvent).detail as 'mobile' | 'tablet' | 'desktop';
      if (!detail) return;
      setViewport(detail);
      try { localStorage.setItem('qs:preview:viewport', detail); } catch {}
    };

    const onColor = (e: Event) => {
      const mode = (e as CustomEvent).detail as 'light' | 'dark';
      try {
        iframeRef.current?.contentWindow?.postMessage({ type: 'preview:set-color-mode', mode }, '*');
        localStorage.setItem('qs:preview:color', mode);
      } catch {}
    };

    window.addEventListener('qs:preview:set-viewport', onViewport as any);
    window.addEventListener('qs:preview:set-color-mode', onColor as any);
    return () => {
      window.removeEventListener('qs:preview:set-viewport', onViewport as any);
      window.removeEventListener('qs:preview:set-color-mode', onColor as any);
    };
  }, []);

  // Build preview URL — do NOT include viewport (avoid reload)
  const qs = new URLSearchParams();
  if (previewVersionId) qs.set('preview_version_id', previewVersionId as string);
  if (pageSlug) qs.set('page', pageSlug as string);
  if (templateId) qs.set('template_id', String(templateId));
  if (industry) qs.set('industry', String(industry));
  if (mode) qs.set('mode', String(mode));
  qs.set('editor', '1'); // enable chrome in iframe

  const path = pageSlug ? `/preview/${encodeURIComponent(pageSlug)}` : `/preview`;
  const src = qs.toString() ? `${path}?${qs.toString()}` : path;

  // Wrapper width (inline style so Tailwind JIT isn’t needed)
  const widthPx =
    viewport === 'mobile' ? 390 :
    viewport === 'tablet' ? 768 :
    undefined; // desktop: full

  // Parent -> iframe init handshake
  const postInit = React.useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    const payload = {
      type: 'preview:init',
      template,
      mode,
      pageSlug: pageSlug ?? null,
      templateId: templateId ?? null,
      rawJson: rawJson ?? null,
      industry: industry ?? null,
    };
    try {
      iframe.contentWindow.postMessage(payload, '*');
      // also push current color preference once on init
      const stored = ((): 'light' | 'dark' => {
        try { return (localStorage.getItem('qs:preview:color') as any) || 'dark'; } catch { return 'dark'; }
      })();
      iframe.contentWindow.postMessage({ type: 'preview:set-color-mode', mode: stored }, '*');
    } catch {}
  }, [template, mode, pageSlug, templateId, rawJson, industry]);

  // Single message handler (iframe -> parent)
  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'preview:change') {
        onChange?.(data.payload);
        if (setRawJson && typeof data.payload?.rawJson === 'string') {
          setRawJson(data.payload.rawJson);
        }
        if (setTemplate && data.payload?.template) {
          setTemplate(data.payload.template);
        }
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

  // Send init on load + when template changes
  React.useEffect(() => { if (loaded) postInit(); }, [loaded, postInit]);
  React.useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(postInit, 50);
    return () => clearTimeout(t);
  }, [template, rawJson, mode, postInit, loaded]);

  // Basic overlay chrome
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
                Edit Header
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
        <iframe
          ref={iframeRef}
          src={src}
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
