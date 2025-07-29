'use client';

import type { Block } from '@/types/blocks';

type HeroNaturalHeightProps = {
    block: Block;
    cropBehavior?: 'cover' | 'contain' | 'none';
  };



export default function HeroNaturalHeight({ block, cropBehavior = 'cover' }: HeroNaturalHeightProps) {
  const { content } = block;
  const { image_url, headline, subheadline, cta_text, cta_link } = content || {};

  if (!image_url) return null;

  return (
    <section className="relative w-full overflow-hidden">
      <img
        src={image_url}
        alt={headline || 'Hero Image'}
        className={`w-full h-auto object-${cropBehavior ?? 'cover'} md:object-cover`}
      />
      <div className="absolute inset-0 flex items-center justify-center px-4 text-white text-center">
        <div className="bg-black/50 backdrop-blur-md p-6 rounded max-w-2xl">
          {headline && (
            <h1 className="text-3xl md:text-5xl font-bold">{headline}</h1>
          )}
          {subheadline && (
            <p className="mt-2 text-lg md:text-xl">{subheadline}</p>
          )}
          {cta_text && cta_link && (
            <a
              href={cta_link}
              className="inline-block mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              {cta_text}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
