// app/preview/PreviewState.tsx
'use client';

import * as React from 'react';
import EditorSiteRenderer from '@/components/sites/editor-site-renderer';

type Props = {
  initialSite: any;
  page: string;
  colorMode: 'light' | 'dark';
  className?: string;
  id?: string;
  editorChrome?: boolean;
};

export default function PreviewState({
  initialSite,
  page,
  colorMode,
  className,
  id = 'site-renderer-page',
  editorChrome,
}: Props) {
  const [site, setSite] = React.useState<any>(initialSite);

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as any;
      if (!d || typeof d !== 'object') return;

      // Both messages may carry { template } or { template: { data: ... } }
      if ((d.type === 'preview:init' || d.type === 'preview:change') && d.template) {
        // shallow-merge, prefer incoming data/pages/header/footer if present
        setSite((prev: any) => {
          const next = { ...prev, ...d.template };
          // keep the pages under whichever field you use
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

  return (
    <EditorSiteRenderer
      site={site}
      page={page}
      id={id}
      colorMode={site?.color_mode === 'light' ? 'light' : 'dark'}
      className={className}
      editorChrome={editorChrome}
    />
  );
}
