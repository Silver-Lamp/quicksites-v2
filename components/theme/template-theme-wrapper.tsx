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
    ? ({ ...resolved.vars, ...(resolved.fontFamily ? { fontFamily: resolved.fontFamily } : {}) } as React.CSSProperties)
    : undefined;

  return (
    <div style={wrapperStyle} data-qs-themed={resolved ? '1' : undefined}>
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
