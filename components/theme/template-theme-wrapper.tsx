'use client';
import * as React from 'react';
import type { Template } from '@/types/template';
import type { Block } from '@/types/blocks';
import PageHeader from '../admin/templates/render-blocks/header';
import PageFooter from '../admin/templates/render-blocks/footer';
import { resolveSiteTheme } from '@/lib/theme/resolveSiteTheme';

type Props = {
  template: Template;
  children?: React.ReactNode;
  onEditHeader?: (b: Block) => void;
  showEditorChrome?: boolean;
  mode: 'template' | 'site';
  renderHeader?: boolean;
  renderFooter?: boolean;
};

export function TemplateThemeWrapper({
  template,
  children,
  onEditHeader,
  showEditorChrome = false,
  mode,
  renderHeader = true,
  renderFooter = true,
}: Props) {
  const headerBlock = template?.headerBlock ?? null;
  const footerBlock = template?.footerBlock ?? null;

  // Scope the site's industry theme (accent/font/radius) onto this wrapper via
  // CSS vars, so shadcn-token blocks (bg-primary, ring, radius) pick it up.
  // Returns null when the site has no themable identity → defaults untouched.
  const resolved = React.useMemo(() => resolveSiteTheme(template), [template]);
  const wrapperStyle = resolved
    ? ({
        ...resolved.vars,
        // Default text color to the theme foreground so blocks that don't set an
        // explicit text token (e.g. menu headings) stay readable in dark themes.
        color: 'hsl(var(--foreground))',
        ...(resolved.fontFamily ? { fontFamily: resolved.fontFamily } : {}),
      } as React.CSSProperties)
    : undefined;

  // Establish the site's light/dark baseline locally (not on <html>): [data-theme]
  // activates the matching shadcn var set for every descendant block using
  // semantic tokens. For curated themes the inline palette vars above sit on the
  // SAME element and win over this baseline, so the neutral tint applies.
  const colorMode: 'light' | 'dark' =
    (template?.color_mode ?? (template as any)?.data?.color_mode) === 'dark' ? 'dark' : 'light';

  return (
    <div style={wrapperStyle} data-theme={colorMode} data-qs-themed={resolved ? '1' : undefined}>
      {/* Load the curated font pairing (Google Fonts). Next hoists & dedupes the
          stylesheet link; display=swap avoids blocking on the webfont. Headings
          pick up var(--font-heading) via the [data-qs-themed] rule in globals.css. */}
      {resolved?.fontHref ? (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={resolved.fontHref} />
        </>
      ) : null}

      {renderHeader && headerBlock ? (
        <div data-editor-section="global-header">
          <PageHeader
            block={headerBlock}
            // showEditorChrome={showEditorChrome}
            // onEdit={onEditHeader}
          />
        </div>
      ) : null}

      {children}

      {renderFooter && footerBlock ? (
        <div data-editor-section="global-footer">
          <PageFooter
            block={footerBlock}
            // showEditorChrome={showEditorChrome}
            // onEdit={onEditFooter}
          />
        </div>
      ) : null}
    </div>
  );

}
