'use client';
import * as React from 'react';
import type { Template } from '@/types/template';
import type { Block } from '@/types/blocks';
import PageHeader from '../admin/templates/render-blocks/header';
import PageFooter from '../admin/templates/render-blocks/footer';
import { resolveSiteTheme } from '@/lib/theme/resolveSiteTheme';
import { readBackdrop, backdropLayerStyle, backdropScrimStyle } from '@/lib/theme/backdrops';

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

  // Site backdrop (lib/theme/backdrops.ts). CSS styles derive from the theme vars scoped
  // on THIS element, so the layers must sit inside it. Both resolve to null when there's
  // nothing to paint — then no layer renders and the site looks exactly as it did before
  // (painterly-backdrop standard rule 7: a missing backdrop is a plain page, never a
  // broken one). Layers are aria-hidden decoration and sit behind content, so they can
  // never carry information or be announced (rule 8).
  const backdrop = React.useMemo(() => readBackdrop(template), [template]);
  const backdropStyle = React.useMemo(() => backdropLayerStyle(backdrop), [backdrop]);
  const scrimStyle = React.useMemo(() => backdropScrimStyle(backdrop), [backdrop]);

  return (
    <div
      style={{ ...(wrapperStyle ?? {}), ...(backdropStyle ? { position: 'relative' } : null) }}
      data-theme={colorMode}
      data-qs-themed={resolved ? '1' : undefined}
      data-qs-backdrop={backdropStyle ? backdrop?.style : undefined}
    >
      {backdropStyle ? (
        <>
          <div
            aria-hidden
            style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', ...backdropStyle }}
          />
          {scrimStyle ? (
            <div
              aria-hidden
              style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', ...scrimStyle }}
            />
          ) : null}
        </>
      ) : null}

      {/* Content sits above the backdrop layers. Only needed when one is painted, so a
          site with no backdrop keeps its original stacking context untouched. */}
      <div style={backdropStyle ? { position: 'relative', zIndex: 1 } : undefined}>
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
    </div>
  );

}
