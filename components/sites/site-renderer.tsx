'use client';

import * as React from 'react';
import clsx from 'clsx';
import RenderBlock from '@/components/admin/templates/render-block';
import MetaHead from '@/components/head/MetaHead';
import ThemeScope from '@/components/ui/theme-scope';
import type { Template } from '@/types/template';
import type { Block } from '@/types/blocks';
import { TemplateThemeWrapper } from '@/components/theme/template-theme-wrapper';
import { getPageBySlug, getEffectiveHeader, getEffectiveFooter } from '@/lib/site-chrome';


type Props = {
  site: Template;
  page: string;
  baseUrl: string;
  enableThemeWrapper?: boolean;
  colorMode?: 'light' | 'dark';
  className?: string;
  id?: string;
};

type SiteRendererProps = {
  site: any;
  page?: string;                 // slug
  baseUrl?: string;
  id?: string;
  className?: string;
  colorMode?: 'light' | 'dark';
  enableThemeWrapper?: boolean;  // some routes pass this
};

export default function SiteRenderer(props: SiteRendererProps) {
  const {
    site,
    page: pageSlug,
    baseUrl,
    id,
    className,
    colorMode = (site?.color_mode as 'light' | 'dark') ?? 'light',
    enableThemeWrapper = true,
  } = props;

  const selectedPage = React.useMemo(() => getPageBySlug(site, pageSlug), [site, pageSlug]);
  const header = React.useMemo(() => getEffectiveHeader(selectedPage, site), [selectedPage, site]);
  const footer = React.useMemo(() => getEffectiveFooter(selectedPage, site), [selectedPage, site]);
  const contentBlocks: any[] = selectedPage?.content_blocks ?? [];

  const body = (
    <div id={id ?? 'site-renderer'} className={clsx('w-full', className)}>
      {/* Header (global or per-page override), hidden if page.show_header === false */}
      {header && <RenderBlock block={header} showDebug={false} colorMode={colorMode} />}

      {/* Page body blocks */}
      {contentBlocks.map((block, i) => (
        <div key={block?._id ?? i}>
          <RenderBlock block={block} showDebug={false} colorMode={colorMode} />
        </div>
      ))}

      {/* Footer (global or per-page override), hidden if page.show_footer === false */}
      {footer && <RenderBlock block={footer} showDebug={false} colorMode={colorMode} />}
    </div>
  );

  if (!enableThemeWrapper) return body;

  return (
    <TemplateThemeWrapper colorMode={colorMode}>
      {body}
    </TemplateThemeWrapper>
  );
}

