'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';
import { useRef } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { useSafeScroll } from '@/hooks/useSafeScroll';
import DebugOverlay from '@/components/ui/debug-overlay';

type HeroBlock = Extract<Block, { type: 'hero' }>;

type Props = {
  block: HeroBlock | undefined;
  content?: HeroBlock['content'];
  compact?: boolean;
  verboseUi?: boolean;
};

export default function HeroRender({
  block,
  content,
  compact = false,
  verboseUi = false,
}: Props) {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const final = content || block?.content;

  if (!block || !final) {
    console.warn('[⚠️ HeroRender] Invalid block or missing content.');
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
  const backgroundPosition =
    image_x && image_y ? `${image_x} ${image_y}` : image_position || 'center';

  let y: string | MotionValue<string> = '0%';
  if (layout_mode === 'full_bleed' && hasImage) {
    const scroll = useSafeScroll({
      target: heroRef as any,
      offset: ['start start', 'end start'],
    });
    if (scroll?.y) y = scroll.y;
  }

  // 🧱 Full-bleed layout
  if (layout_mode === 'full_bleed' && hasImage) {
    return (
      <div ref={heroRef} className="relative w-full text-white max-h-[90vh] overflow-hidden">
        {verboseUi && (
          <DebugOverlay>
            {`[HeroBlock]\nLayout: full_bleed\nImage: ${image_url || 'N/A'}`}
          </DebugOverlay>
        )}
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
          {subheadline && <p className="text-lg md:text-2xl mb-6 drop-shadow">{subheadline}</p>}
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
        {verboseUi && (
          <DebugOverlay>
            {`[HeroBlock]\nLayout: background\nImage: ${image_url || 'N/A'}`}
          </DebugOverlay>
        )}
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
          {subheadline && <p className="text-lg md:text-xl mb-6 drop-shadow">{subheadline}</p>}
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

  // 📸 Inline layout
  return (
    <SectionShell
      compact={compact}
      bg="bg-neutral-900 text-white rounded-lg shadow"
      textAlign="center"
    >
      {verboseUi && (
        <DebugOverlay>
          {`[HeroBlock]\nLayout: inline\nImage: ${hasImage ? 'yes' : 'no'}`}
        </DebugOverlay>
      )}
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
