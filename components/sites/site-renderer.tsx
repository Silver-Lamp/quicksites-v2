// components/sites/site-renderer.tsx
'use client';

import * as React from 'react';
import clsx from 'clsx';
import RenderBlock from '@/components/admin/templates/render-block';
import { TemplateThemeWrapper } from '@/components/theme/template-theme-wrapper';
import type { Template } from '@/types/template';
import {
  getPageBySlug,
  getEffectiveHeader,
  getEffectiveFooter,
  stripHeaderFooter,
} from '@/lib/site-chrome';

type SiteRendererProps = {
  site: Template;
  page?: string;                 // page slug (optional; will default to first page)
  baseUrl?: string;
  id?: string;
  className?: string;
  colorMode?: 'light' | 'dark';
  enableThemeWrapper?: boolean;
};

export default function SiteRenderer({
  site,
  page: pageSlug,
  id,
  className,
  colorMode = (site?.color_mode as 'light' | 'dark') ?? 'light',
  enableThemeWrapper = true,
}: SiteRendererProps) {
  const selectedPage = React.useMemo(
    () => getPageBySlug(site, pageSlug),
    [site, pageSlug]
  );

  const header = React.useMemo(
    () => getEffectiveHeader(selectedPage, site),
    [selectedPage, site]
  );
  const footer = React.useMemo(
    () => getEffectiveFooter(selectedPage, site),
    [selectedPage, site]
  );

  // Body blocks should never include header/footer blocks
  const bodyBlocks = React.useMemo(
    () => stripHeaderFooter(selectedPage?.content_blocks),
    [selectedPage?.content_blocks]
  );

  const body = (
    <div id={id ?? 'site-renderer'} className={clsx('w-full', className)}>
      {header && <RenderBlock block={header} showDebug={false} colorMode={colorMode} />}

      {bodyBlocks.map((block: any, i: number) => (
        <div key={block?._id ?? i}>
          <RenderBlock block={block} showDebug={false} colorMode={colorMode} />
        </div>
      ))}

      {footer && <RenderBlock block={footer} showDebug={false} colorMode={colorMode} />}
    </div>
  );

  if (!enableThemeWrapper) return body;

  return <TemplateThemeWrapper mode="site" renderHeader={false} renderFooter={false} template={site}>{body}</TemplateThemeWrapper>;
}
    