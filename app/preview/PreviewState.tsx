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
