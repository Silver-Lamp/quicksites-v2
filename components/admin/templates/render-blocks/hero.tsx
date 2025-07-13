'use client';
import type { Block } from '@/types/blocks';

type HeroBlock = Extract<Block, { type: 'hero' }>;

export default function HeroRender({ block }: { block: HeroBlock }) {
  const { headline, subheadline, cta_text, cta_link, image_url } = block.content;

  const safeImage = image_url?.startsWith('blob:') ? undefined : image_url;

  return (
    <section className="bg-neutral-900 text-white py-16 px-4 md:px-12 text-center rounded-lg shadow-lg">
      {safeImage && (
        <img
          src={safeImage}
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
