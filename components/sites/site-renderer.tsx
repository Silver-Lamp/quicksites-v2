// components/sites/site-renderer.tsx
'use client';

import * as React from 'react';
import clsx from 'clsx';
import RenderBlock from '@/components/admin/templates/render-block';
import { TemplateThemeWrapper } from '@/components/theme/template-theme-wrapper';
import { resolveSiteLayout } from '@/lib/theme/resolveSiteLayout';
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
  baseUrl?: string;              // optional, for absolute links/canonicals
  id?: string;
  className?: string;
  colorMode?: 'light' | 'dark';
  enableThemeWrapper?: boolean;
  editorChrome?: boolean;        // ← NEW: allow editor chrome flag
};

export default function SiteRenderer({
  site,
  page: pageSlug,
  id,
  className,
  colorMode = (site?.color_mode as 'light' | 'dark') ?? 'light',
  enableThemeWrapper = true,
  baseUrl,                       // ← NEW (already typed)
  editorChrome,                  // ← NEW
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

  // Layout personality (rhythm/density/…) from the curated theme; null on legacy
  // sites → plain stack untouched.
  const layout = React.useMemo(() => resolveSiteLayout(site), [site]);

  const body = (
    <div
      id={id ?? 'site-renderer'}
      // Paint the themed page surface so the whole site sits on one background
      // (--background). Without this, card blocks (bg-card) render dark on a
      // dark-mode site while transparent sections show the unpainted page →
      // a light/dark mix. bg-background/text-foreground resolve from the
      // data-theme scope (this element or the theme wrapper above it).
      className={clsx('w-full min-h-screen bg-background text-foreground', className)}
      data-editor-chrome={editorChrome ? '1' : undefined} // ← NEW
      data-base-url={baseUrl || undefined}                // ← NEW
      // When the theme wrapper is disabled, still establish the light/dark
      // baseline here so semantic-token blocks resolve correctly. When the
      // wrapper IS used, it owns data-theme (+ palette) — don't double-set it,
      // or this inner scope would clobber the wrapper's neutral tint.
      data-theme={enableThemeWrapper ? undefined : colorMode}
    >
      {header && (
        <RenderBlock
          block={header}
          showDebug={false}
          colorMode={colorMode}
          template={site}
        />
      )}

      {bodyBlocks.map((block: any, i: number) => {
        // Banded rhythm: alternate a muted section surface behind content blocks
        // (never the hero at i=0). Only visible where blocks use semantic/transparent
        // backgrounds; hardcoded-bg legacy blocks simply cover it.
        const banded = layout?.rhythm === 'banded' && i > 0 && i % 2 === 1;
        return (
          <div
            key={block?._id ?? i}
            data-band={banded ? '1' : undefined}
            style={banded ? { background: 'hsl(var(--muted))' } : undefined}
          >
            <RenderBlock
              block={block}
              showDebug={false}
              colorMode={colorMode}
              template={site}
            />
          </div>
        );
      })}

      {footer && (
        <RenderBlock
          block={footer}
          showDebug={false}
          colorMode={colorMode}
          template={site}
        />
      )}
    </div>
  );

  if (!enableThemeWrapper) return body;

  return (
    <TemplateThemeWrapper
      mode="site"
      renderHeader={false}
      renderFooter={false}
      template={site}
    >
      {body}
    </TemplateThemeWrapper>
  );
}
