'use client';

import type { Block } from '@/types/blocks';
import RenderBlock from './render-block';

type Props = {
  block: Block;
  className?: string;
};

export default function RenderBlockMini({ block, className = '' }: Props) {
  return (
    <div className={`rounded border dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 ${className}`}>
      <RenderBlock
        block={block}
        compact
        mode="preview"
        disableInteraction
      />
    </div>
  );
}
