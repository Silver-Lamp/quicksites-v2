'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

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
    layout_mode = 'background',
    blur_amount = 8,
    image_position,
    image_x,
    image_y,
  } = final;

  const hasImage = image_url?.trim() !== '';
  const blurPx = `${blur_amount}px`;
  const backgroundPosition = image_x && image_y
    ? `${image_x} ${image_y}`
    : image_position || 'center';

  // ✅ Ref and scroll motion logic
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  // Parallax: moves image up as user scrolls down
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '-20%']);

  // 🧱 Full-bleed layout
  if (layout_mode === 'full_bleed' && hasImage) {
    return (
      <div ref={heroRef} className="relative w-full text-white max-h-[90vh] overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-fixed"
          style={{
            y,
            backgroundImage: `url(${image_url})`,
            backgroundSize: 'cover',
            backgroundPosition,
            filter: `blur(${blurPx}) brightness(0.6)`,
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-32 pb-20 text-center sm:pt-24 sm:pb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow">{headline}</h1>
          {subheadline && (
            <p className="text-lg md:text-2xl mb-6 drop-shadow">{subheadline}</p>
          )}
          {cta_text && cta_link && (
            <a
              href={cta_link}
              className="inline-block bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-full transition"
            >
              {cta_text}
            </a>
          )}
        </div>
      </div>
    );
  }

  // 🖼️ Background image layout
  if (layout_mode === 'background' && hasImage) {
    return (
      <SectionShell
        compact={compact}
        className="relative text-white rounded-lg overflow-hidden"
        textAlign="center"
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${image_url})`,
            backgroundSize: 'cover',
            backgroundPosition,
            filter: `blur(${blurPx}) brightness(0.5)`,
          }}
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 py-16 px-4">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 drop-shadow">{headline}</h1>
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

  // 📸 Inline image layout
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
