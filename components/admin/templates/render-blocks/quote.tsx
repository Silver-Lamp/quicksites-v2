'use client';

import type { QuoteBlock } from '@/types/blocks';

export default function QuoteBlock({ content }: { content?: QuoteBlock['content'] }) {
  if (!content) {
    return (
      <blockquote className="text-red-500 italic">⚠️ Missing content for quote block.</blockquote>
    );
  }

  return (
    <blockquote className="border-l-4 pl-4 italic text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 mb-4">
      “{content.text}”
      {content.attribution && (
        <footer className="mt-1 text-sm text-right text-gray-500 dark:text-gray-400">
          — {content.attribution}
        </footer>
      )}
    </blockquote>
  );
}