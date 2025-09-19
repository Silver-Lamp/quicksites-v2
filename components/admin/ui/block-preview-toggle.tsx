'use client';

import { useState } from 'react';
import type { Block } from '@/types/blocks';
import RenderBlock from '@/components/admin/templates/render-block';
import { Switch } from '@/components/ui/switch';
import type { Template } from '@/types/template';

type Props = {
  block: Block;
  className?: string;
  template: Template;
};

export default function BlockPreviewToggle({ block, className = '', template }: Props) {
  const [enabled, setEnabled] = useState(true);
  const [compact, setCompact] = useState(true);

  return (
    <div className={`pt-6 space-y-2 ${className}`}>
      <div className="flex items-left gap-2">
        <Switch checked={enabled} onCheckedChange={setEnabled} />
        <span className="text-sm font-medium text-white">Show Live Preview</span>
      </div>

      {enabled && (
        <>
          <div className="flex items-left gap-2">
            <Switch checked={compact} onCheckedChange={setCompact} />
            <span className="text-sm text-white">Compact Layout</span>
          </div>

          <div className="mt-3 rounded border border-neutral-700 bg-neutral-800 p-4">
            <RenderBlock block={block} showDebug={false} compact={compact} mode="preview" disableInteraction template={template} />
          </div>
        </>
      )}
    </div>
  );
}
