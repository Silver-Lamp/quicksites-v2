// components/admin/templates/render-block-mini.tsx
'use client';

import type { Block } from '@/types/blocks';
import RenderBlock from './render-block';
import type { Template } from '@/types/template';

type Props = {
  block: Block;
  className?: string;
  showDebug?: boolean;
  colorMode?: 'light' | 'dark';
  template: Template;
};

export default function RenderBlockMini({ block, className = '', showDebug = false, colorMode = 'dark', template }: Props) {
  return (
    <div className={`rounded border dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 ${className}`}>
      <RenderBlock
        block={block}
        compact
        mode="preview"
        disableInteraction
        previewOnly
        showDebug={showDebug}
        colorMode={colorMode}
        template={template}
      />
    </div>
  );
}
