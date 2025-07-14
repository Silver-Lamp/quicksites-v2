'use client';

import type { Block } from '@/types/blocks';

type ServicesBlock = Extract<Block, { type: 'services' }>;

type Props = {
  block?: ServicesBlock;
  compact?: boolean;
};

export default function ServicesBlock({ block, compact = false }: Props) {
  const content = block?.content;

  if (!content) {
    return (
      <div className="text-red-500 italic text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        ⚠️ Missing services block content.
      </div>
    );
  }

  return (
    <div
      className={`${
        compact
          ? 'text-sm p-2'
          : 'mb-6 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white'
      }`}
    >
      <h3 className={compact ? 'font-semibold mb-1' : 'text-xl font-semibold mb-2'}>
        Our Services
      </h3>
      <ul
        className={`grid gap-1 ${
          compact ? 'list-disc list-inside' : 'list-disc list-inside'
        }`}
      >
        {content.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
