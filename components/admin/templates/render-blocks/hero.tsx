'use client';

import type { Block } from '@/types/blocks';

type HeroBlock = Extract<Block, { type: 'hero' }>;

type Props = {
  block: HeroBlock | undefined;
  compact?: boolean;
};

export default function HeroRender({ block, compact = false }: Props) {
  if (!block || !block.content) {
    return (
      <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        Invalid hero block
      </div>
    );
  }

  const { headline, subheadline, cta_text, cta_link, image_url } = block.content;
  const safeImage = image_url || undefined;

  return (
    <section
      className={`${
        compact
          ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white p-2 text-sm'
          : 'bg-neutral-900 text-white py-16 px-4 md:px-12 text-center rounded-lg shadow-lg'
      }`}
    >
      {safeImage && !compact && (
        <img
          src={safeImage}
          alt={headline || 'Hero Image'}
          className="mx-auto mb-6 rounded-xl shadow max-h-96 object-cover"
        />
      )}

      <h1 className={`${compact ? 'text-base font-semibold' : 'text-3xl md:text-5xl font-bold mb-4'}`}>
        {headline}
      </h1>

      {!compact && subheadline && (
        <p className="text-lg md:text-xl mb-6">{subheadline}</p>
      )}

      {!compact && cta_text && cta_link && (
        <a
          href={cta_link}
          className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-full transition"
        >
          {cta_text}
        </a>
      )}
    </section>
  );
}
