'use client';

import type { ServicesBlock } from '@/types/blocks';

export default function ServicesBlock({ content }: { content: ServicesBlock['content'] }) {
  return (
    <div className="mb-6 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white">
      <h3 className="text-xl font-semibold mb-2">Our Services</h3>
      <ul className="grid gap-2 list-disc list-inside">
        {content.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
