'use client';

import type { TestimonialBlock } from '@/types/blocks';

export default function TestimonialBlock({ content }: { content?: TestimonialBlock['content'] }) {
  if (!content) {
    return <div className="italic text-red-500">⚠️ Missing testimonial block content.</div>;
  }

  return (
    <div className="mb-6 border-l-4 pl-4 border-blue-500 text-gray-800 dark:text-gray-200 italic bg-white dark:bg-neutral-900">
      “{content.quote}”
      {content.attribution && (
        <footer className="mt-2 text-sm text-blue-600 dark:text-blue-300">
          — {content.attribution}
        </footer>
      )}
    </div>
  );
}