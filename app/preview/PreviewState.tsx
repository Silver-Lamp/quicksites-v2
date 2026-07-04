// app/preview/PreviewState.tsx
'use client';

import * as React from 'react';
import EditorSiteRenderer from '@/components/sites/editor-site-renderer';

export type PreviewStateProps = {
  initialSite: any;
  page: string;
  colorMode: 'light' | 'dark';
  className?: string;
  id?: string;
  editorChrome?: boolean;
  baseUrl?: string;   // ← keep this here
};

export default function PreviewState({
  initialSite,
  page,
  colorMode,
  className,
  id = 'site-renderer-page',
  editorChrome,
  baseUrl,
}: PreviewStateProps) {
  const [site, setSite] = React.useState<any>(initialSite);

  const resolvedBaseUrl = React.useMemo(() => {
    if (baseUrl) return baseUrl;
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }, [baseUrl]);

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as any;
      if (!d || typeof d !== 'object') return;
      if ((d.type === 'preview:init' || d.type === 'preview:change') && d.template) {
        setSite((prev: any) => {
          const next = { ...prev, ...d.template };
          if (d.template?.data?.pages || d.template?.pages) {
            next.data = { ...(prev?.data ?? {}), ...(d.template?.data ?? {}) };
          }
          return next;
        });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // "Click to edit header/footer" affordance: the rendered header/footer post a
  // `qs:edit-header` / `qs:edit-footer` message to window.parent. Inside the editor
  // iframe the parent is the editor, which opens the panel. On the STANDALONE
  // preview page (top-level tab, e.g. the guest Preview link) window.parent is this
  // same window and no editor is listening — so the click did nothing. Here we catch
  // it and send the owner into the editor, auto-opening the matching panel.
  React.useEffect(() => {
    if (typeof window === 'undefined' || window.self !== window.top) return;
    function onEdit(e: MessageEvent) {
      const t = (e.data as any)?.type;
      if (t !== 'qs:edit-header' && t !== 'qs:edit-footer') return;
      const which = t === 'qs:edit-header' ? 'header' : 'footer';
      const sp = new URLSearchParams(window.location.search);
      const id = sp.get('template_id') || site?.id;
      if (!id) return;
      window.location.href = `/admin/templates/${id}?edit=${which}`;
    }
    window.addEventListener('message', onEdit);
    return () => window.removeEventListener('message', onEdit);
  }, [site?.id]);

  const renderColorMode: 'light' | 'dark' =
    colorMode ?? (site?.color_mode === 'light' ? 'light' : 'dark');

  return (
    <EditorSiteRenderer
      site={site}
      page={page}
      id={id}
      colorMode={renderColorMode}
      className={className}
      editorChrome={editorChrome}
      baseUrl={resolvedBaseUrl}
    />
  );
}
