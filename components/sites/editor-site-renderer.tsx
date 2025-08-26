// components/sites/editor-site-renderer.tsx
'use client';

import * as React from 'react';
import type { Block } from '@/types/blocks';
import RenderBlock from '@/components/admin/templates/render-block';
import SiteRenderer from '@/components/sites/site-renderer'; // fallback

const QS_DEBUG = process.env.QSITES_DEBUG === '1';

type Props = {
  site: any;                  // normalized object from preview page
  page: string;
  id?: string;
  colorMode?: 'light' | 'dark';
  className?: string;
  editorChrome?: boolean;     // set to true when embedded in editor (adds data-editor-chrome="1")
};

function qlog(msg: string, extra?: any) {
  if (!QS_DEBUG) return;
  try {
    // eslint-disable-next-line no-console
    console.log('[EditorSiteRenderer]', msg, extra ?? '');
  } catch {}
}

/** Try hard to resolve pages and blocks no matter how the site is shaped */
function getPages(site: any): any[] {
  if (Array.isArray(site?.pages)) return site.pages;
  if (Array.isArray(site?.data?.pages)) return site.data.pages;
  if (Array.isArray(site?.content?.pages)) return site.content.pages;
  return [];
}

function getBlocksForPage(p: any): Block[] {
  if (Array.isArray(p?.blocks)) return p.blocks as Block[];
  if (Array.isArray(p?.content?.blocks)) return p.content.blocks as Block[];
  if (Array.isArray(p?.content_blocks)) return p.content_blocks as Block[];
  if (p?.block && typeof p.block === 'object') return [p.block as Block];
  return [];
}

function resolveHeaderBlock(site: any, page: any): Block | null {
  // per-page override takes precedence if present
  const override = page?.headerOverride;
  if (override && override.type === 'header') return override as Block;
  // otherwise use site/global header block
  return (
    site?.headerBlock ??
    site?.data?.headerBlock ??
    site?.data?.header ??
    null
  );
}

function resolveFooterBlock(site: any, page: any): Block | null {
  const override = page?.footerOverride;
  if (override && override.type === 'footer') return override as Block;
  return (
    site?.footerBlock ??
    site?.data?.footerBlock ??
    site?.data?.footer ??
    null
  );
}

export default function EditorSiteRenderer({
  site,
  page,
  id,
  colorMode = 'light',
  className,
  editorChrome,
}: Props) {
  const pages = React.useMemo(() => getPages(site), [site]);

  // pick current page + its index
  const { current, pageIdx } = React.useMemo(() => {
    let idx = pages.findIndex((p) => p?.slug === page || p?.id === page);
    if (idx < 0) idx = 0;
    return { current: pages[idx], pageIdx: idx };
  }, [pages, page]);

  const blocks = React.useMemo(
    () => (current ? getBlocksForPage(current) : []),
    [current]
  );

  if (!current) {
    qlog('No current page; falling back to public SiteRenderer', { page });
    return (
      <SiteRenderer
        site={site}
        page={page}
        id={id ?? 'site-renderer-page'}
        colorMode={colorMode}
        className={className}
      />
    );
  }

  // Respect per-page visibility flags; default ON when undefined
  const showHeader = current?.show_header !== false;
  const showFooter = current?.show_footer !== false;

  // Resolve header/footer blocks with per-page overrides
  const headerBlock = resolveHeaderBlock(site, current);
  const footerBlock = resolveFooterBlock(site, current);

  return (
    <main
      id={id ?? 'editor-site-renderer'}
      className={className}
      data-color-mode={colorMode}
      data-editor-chrome={editorChrome ? '1' : '0'}
      data-site-domain={(site?.domain ?? '').toString()}                 // ⬅️ NEW
      data-site-subdomain={(site?.default_subdomain ?? '').toString()}   // ⬅️ NEW
    >
      {/* Header (if enabled and present) */}
      {showHeader && headerBlock && (
        <div data-site-header="">
          <RenderBlock
            block={headerBlock}
            template={site}
            mode="preview"
            colorMode={colorMode}
            previewOnly
          />
        </div>
      )}

      {/* Page blocks */}
      {blocks.map((block, blockIdx) => {
        const key =
          (block as any)?._id ??
          (block as any)?.id ??
          `${pageIdx}:${blockIdx}`;
        const path = `${pageIdx}:${blockIdx}`;

        return (
          <div key={key} data-block-path={path}>
            <RenderBlock
              block={block}
              template={site}
              mode="preview"
              colorMode={colorMode}
              previewOnly
              blockPath={path}
            />
          </div>
        );
      })}

      {/* Footer (if enabled and present) */}
      {showFooter && footerBlock && (
        <div data-site-footer="">
          <RenderBlock
            block={footerBlock}
            template={site}
            mode="preview"
            colorMode={colorMode}
            previewOnly
          />
        </div>
      )}
    </main>
  );
}
