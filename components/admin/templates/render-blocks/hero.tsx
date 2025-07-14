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

  const {
    headline,
    subheadline,
    cta_text,
    cta_link,
    image_url,
    show_image_as_bg = false,
  } = block.content;

  const hasImage = image_url && image_url.trim() !== '';

  if (show_image_as_bg && hasImage) {
    return (
      <section
        className="relative text-white py-24 px-4 md:px-12 text-center rounded-lg shadow-lg overflow-hidden"
        style={{
          backgroundImage: `url(${image_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">{headline}</h1>
          {subheadline && <p className="text-lg md:text-xl mb-6">{subheadline}</p>}
          {cta_text && cta_link && (
            <a
              href={cta_link}
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-full transition"
            >
              {cta_text}
            </a>
          )}
        </div>
      </section>
    );
  }

  // Default (inline image)
  return (
    <section className="bg-neutral-900 text-white py-16 px-4 md:px-12 text-center rounded-lg shadow-lg">
      {hasImage && (
        <img
          src={image_url}
          alt={headline || 'Hero Image'}
          className="mx-auto mb-6 rounded-xl shadow max-h-96 object-cover"
        />
      )}
      <h1 className="text-3xl md:text-5xl font-bold mb-4">{headline}</h1>
      {subheadline && <p className="text-lg md:text-xl mb-6">{subheadline}</p>}
      {cta_text && cta_link && (
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
