'use client';

import { useState } from 'react';
import type { Block } from '@/types/blocks';
import RenderBlock from '@/components/admin/templates/render-block';
import { Switch } from '@/components/ui/switch';

type Props = {
  block: Block;
  className?: string;
};

export default function BlockPreviewToggle({ block, className = '' }: Props) {
  const [enabled, setEnabled] = useState(true);
  const [compact, setCompact] = useState(true);

  return (
    <div className={`pt-6 space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">Show Live Preview</span>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white">Compact Layout</span>
            <Switch checked={compact} onCheckedChange={setCompact} />
          </div>

          <div className="mt-3 rounded border border-neutral-700 bg-neutral-800 p-4">
            <RenderBlock block={block} compact={compact} mode="preview" disableInteraction />
          </div>
        </>
      )}
    </div>
  );
}
