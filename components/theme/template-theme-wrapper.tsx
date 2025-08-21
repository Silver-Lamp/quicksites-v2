'use client';
import type { Template } from '@/types/template';
import type { Block } from '@/types/blocks';
import PageHeader from '../admin/templates/render-blocks/header';
import PageFooter from '../admin/templates/render-blocks/footer';

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

  return (
    <div /* your wrapper */>
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
