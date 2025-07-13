'use client';

import type { HeroBlock } from '@/types/blocks';

export default function HeroBlock({ content }: { content?: HeroBlock['content'] }) {
  if (!content) {
    return (
      <section className="mb-8 text-center text-red-500 italic">
        ⚠️ Missing content for hero block.
      </section>
    );
  }

  return (
    <section className="mb-8 text-center bg-white text-gray-900 dark:bg-neutral-900 dark:text-white">
      <h1 className="text-3xl font-bold mb-2">{content.title}</h1>
      {content.description && (
        <p className="text-gray-600 dark:text-gray-400 mb-4">{content.description}</p>
      )}
      {content.cta_label && content.cta_link && (
        <a
          href={content.cta_link}
          className="inline-block px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          {content.cta_label}
        </a>
      )}
    </section>
  );
}