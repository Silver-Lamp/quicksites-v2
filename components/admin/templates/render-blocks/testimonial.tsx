'use client';

import type { Block } from '@/types/blocks';

type TestimonialBlock = Extract<Block, { type: 'testimonial' }>;

type Props = {
  block?: TestimonialBlock;
  compact?: boolean;
};

export default function TestimonialBlock({ block, compact = false }: Props) {
  const content = block?.content;

  if (!content) {
    return (
      <div className="italic text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        ⚠️ Missing testimonial block content.
      </div>
    );
  }

  return (
    <div
      className={`border-l-4 pl-4 italic ${
        compact
          ? 'text-sm border-blue-400 text-gray-700 dark:text-gray-300'
          : 'mb-6 border-blue-500 text-gray-800 dark:text-gray-200 bg-white dark:bg-neutral-900'
      }`}
    >
      “{content.quote}”
      {content.attribution && (
        <footer
          className={`mt-1 text-xs ${
            compact
              ? 'text-blue-500 dark:text-blue-300'
              : 'text-sm text-blue-600 dark:text-blue-300'
          }`}
        >
          — {content.attribution}
        </footer>
      )}
    </div>
  );
}
