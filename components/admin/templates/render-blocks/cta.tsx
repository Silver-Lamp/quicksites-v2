'use client';

import type { Block } from '@/types/blocks';

type CtaBlock = Extract<Block, { type: 'cta' }>;

type Props = {
  block?: CtaBlock;
  compact?: boolean;
};

export default function CtaBlock({ block, compact = false }: Props) {
  const content = block?.content;

  if (!content) {
    return (
      <div className="text-red-500 italic text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        ⚠️ Missing content for CTA block.
      </div>
    );
  }

  return (
    <div className={compact ? 'text-left p-2' : 'mb-6 text-center'}>
      <a
        href={content.link}
        className={`inline-block font-medium transition ${
          compact
            ? 'text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700'
            : 'px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700'
        }`}
      >
        {content.label}
      </a>
    </div>
  );
}
