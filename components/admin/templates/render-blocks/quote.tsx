'use client';

import type { Block } from '@/types/blocks';

type QuoteBlock = Extract<Block, { type: 'quote' }>;

type Props = {
  block?: QuoteBlock;
  compact?: boolean;
};

export default function QuoteBlock({ block, compact = false }: Props) {
  const content = block?.content;

  if (!content) {
    return (
      <blockquote className="text-red-500 italic text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        ⚠️ Missing content for quote block.
      </blockquote>
    );
  }

  return (
    <blockquote
      className={`border-l-4 pl-4 italic ${
        compact
          ? 'text-sm border-gray-400 text-gray-700 dark:text-gray-300'
          : 'mb-4 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
      }`}
    >
      “{content.text}”
      {content.attribution && (
        <footer
          className={`mt-1 ${
            compact ? 'text-xs text-right' : 'text-sm text-right'
          } text-gray-500 dark:text-gray-400`}
        >
          — {content.attribution}
        </footer>
      )}
    </blockquote>
  );
}
