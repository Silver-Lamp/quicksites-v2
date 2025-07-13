'use client';

import type { TextBlock } from '@/types/blocks';

export default function TextBlock({ content }: { content: TextBlock['content'] }) {
  return (
    <p className="mb-4 text-base text-gray-900 dark:text-gray-100">
      {content.value}
    </p>
  );
}
