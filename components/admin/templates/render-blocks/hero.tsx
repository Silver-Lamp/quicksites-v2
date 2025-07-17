'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type HeroBlock = Extract<Block, { type: 'hero' }>;

type Props = {
  block: HeroBlock | undefined;
  content?: HeroBlock['content'];
  compact?: boolean;
};

export default function HeroRender({ block, content, compact = false }: Props) {
  const final = content || block?.content;

  if (!block || !final) {
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
  } = final;

  const hasImage = image_url?.trim() !== '';

  // 🖼️ Background image layout
  if (show_image_as_bg && hasImage) {
    return (
      <SectionShell
        compact={compact}
        className="relative text-white rounded-lg overflow-hidden"
        textAlign="center"
      >
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          style={{
            backgroundImage: `url(${image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="relative z-10">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 drop-shadow-lg">{headline}</h1>
          {subheadline && (
            <p className="text-lg md:text-xl mb-6 drop-shadow">{subheadline}</p>
          )}
          {cta_text && cta_link && (
            <a
              href={cta_link}
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-full transition"
            >
              {cta_text}
            </a>
          )}
        </div>
      </SectionShell>
    );
  }

  // 🧱 Inline image layout
  return (
    <SectionShell
      compact={compact}
      bg="bg-neutral-900 text-white rounded-lg shadow"
      textAlign="center"
    >
      {hasImage && (
        <img
          src={image_url}
          alt={headline || 'Hero image'}
          className="mx-auto mb-6 rounded-xl shadow max-h-96 w-full object-cover"
        />
      )}
      <h1 className="text-3xl md:text-5xl font-bold mb-4">{headline}</h1>
      {subheadline && <p className="text-lg md:text-xl mb-6">{subheadline}</p>}
      {cta_text && cta_link && (
        <a
          href={cta_link}
          className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-full transition"
        >
          {cta_text}
        </a>
      )}
    </SectionShell>
  );
}
