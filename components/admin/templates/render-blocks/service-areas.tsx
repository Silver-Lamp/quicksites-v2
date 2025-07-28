'use client';

import type { Block } from '@/types/blocks';

export default function RenderServiceAreas({ block }: { block: Block }) {
  const { title = 'Our Service Areas', subtitle, cities = [] } = block.content;

  return (
    <section className="py-8 glow-card-purple rounded-lg p-4">
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      {subtitle && <p className="mb-4 text-neutral-600 dark:text-neutral-300">{subtitle}</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-lg">
        {cities.map((city: string) => (
          <div key={city} className="before:content-['•'] before:mr-2">
            {city}
          </div>
        ))}
      </div>
    </section>
  );
}
