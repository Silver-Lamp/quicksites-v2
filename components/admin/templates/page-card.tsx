// components/admin/templates/page-card.tsx
'use client';

import { useMemo } from 'react';
import { PageHeaderForm } from './page-header-form';
import { PageControls } from './page-controls';
import { PageBlocksList } from './page-blocks-list';
import type { Template, Page } from '@/types/template';
import { Button } from '@/components/ui/button';
import { industryPresets } from '@/lib/presets';

type Props = {
  page: Page;
  index: number;
  total: number;
  template: Template;
  expanded?: boolean;
  onToggle?: () => void;
  onChange: (updated: Template) => void;
  onLivePreviewUpdate: (data: Template['data']) => void;
  onUpdatePageMeta: (id: string, field: keyof Page, value: string) => void;
  onMovePage: (index: number, direction: 'up' | 'down') => void;
  onRemovePage: (id: string) => void;
};

export function PageCard({
  page,
  index,
  total,
  template,
  expanded = true,
  onToggle,
  onChange,
  onLivePreviewUpdate,
  onUpdatePageMeta,
  onMovePage,
  onRemovePage,
}: Props) {
  const detectedType = useMemo(() => {
    const preset = industryPresets[template.industry?.toLowerCase() || 'default'];
    if (!preset || !page.content_blocks.length) return null;

    return Object.keys(preset).find((key) => {
      const block = preset[key];
      return JSON.stringify(block) === JSON.stringify(page.content_blocks[0]);
    });
  }, [template.industry, page.content_blocks]);

  return (
    <div key={page.id} className="border p-3 rounded-md space-y-2 bg-muted">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          {page.title || 'Untitled Page'}
          {detectedType && (
            <span className="text-xs bg-white/10 text-muted-foreground px-2 py-0.5 rounded">
              {detectedType.charAt(0).toUpperCase() + detectedType.slice(1)} Page
            </span>
          )}
        </div>

        <Button variant="ghost" size="sm" onClick={onToggle}>
          {expanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>

      {expanded && (
        <>
          <div className="flex justify-between gap-2">
            <PageHeaderForm
              page={page}
              onChange={(field, value) => onUpdatePageMeta(page.id, field, value)}
            />
            <PageControls
              index={index}
              total={total}
              onMoveUp={() => onMovePage(index, 'up')}
              onMoveDown={() => onMovePage(index, 'down')}
              onRemove={() => onRemovePage(page.id)}
            />
          </div>

          <PageBlocksList
            page={page}
            template={template}
            onChange={onChange}
            onLivePreviewUpdate={onLivePreviewUpdate}
          />
        </>
      )}
    </div>
  );
}
