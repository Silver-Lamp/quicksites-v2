'use client';

import type { ButtonBlock } from '@/types/blocks';

export default function ButtonBlock({ content }: { content: ButtonBlock['content'] }) {
  const styleClass =
    content.style === 'ghost'
      ? 'bg-transparent border border-gray-300 text-gray-800 dark:text-gray-100'
      : content.style === 'secondary'
      ? 'bg-gray-600 hover:bg-gray-700 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <a
      href={content.href}
      className={`inline-block px-4 py-2 rounded text-sm mb-4 transition ${styleClass}`}
    >
      {content.label}
    </a>
  );
}
