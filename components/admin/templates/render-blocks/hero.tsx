// components/admin/templates/render-blocks/hero.tsx
'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { useSafeScroll } from '@/hooks/useSafeScroll';
import DebugOverlay from '@/components/ui/debug-overlay';
import HeroNaturalHeight from './hero-natural-height';
import { useIsMobile } from '@/hooks/useIsMobile';

type Props = {
  block: Block | undefined;
  content?: Block['content'];
  compact?: boolean;
  showDebug?: boolean;
  /** Optional — parent (RenderBlock) can pass the resolved mode */
  colorMode?: 'light' | 'dark';
};

export default function HeroRender({
  block,
  content,
  compact = false,
  showDebug = false,
  colorMode,
}: Props) {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const final = content;

  // derive mode from <html class="dark"> if not provided
  const [detectedMode, setDetectedMode] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    if (colorMode) return;
    if (typeof document !== 'undefined') {
      setDetectedMode(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    }
  }, [colorMode]);
  const mode = colorMode ?? detectedMode;
  const isDark = mode === 'dark';

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
    layout_mode = 'inline',
    mobile_layout_mode = 'inline',
    mobile_crop_behavior = 'cover',
    blur_amount = 8,
    parallax_enabled,
    image_position,
    image_x,
    image_y,
  } = final as any;

  const isMobile = useIsMobile();
  const activeLayoutMode =
    typeof window === 'undefined' ? layout_mode : (isMobile ? mobile_layout_mode : layout_mode);

  const hasImage = (image_url as string)?.trim() !== '';
  const blurPx = `${blur_amount}px`;
  const backgroundPosition =
    image_x && image_y ? `${image_x} ${image_y}` : image_position || 'center';

  const scroll = useSafeScroll({
    target: heroRef as any,
    offset: ['start start', 'end start'],
  });

  let y: string | MotionValue<string> = '0%';
  if (activeLayoutMode === 'full_bleed' && hasImage && scroll?.y) {
    y = scroll.y;
  }

  // shared tokens that flip with mode
  const textPrimary = isDark ? 'text-white' : 'text-black';
  const textSecondary = isDark ? 'text-white' : 'text-neutral-800';
  const overlayTint = isDark ? 'bg-black/40' : 'bg-white/40';
  const fullBleedBrightness = isDark ? 'brightness(0.6)' : 'brightness(0.9)'; // darker in dark mode, lighter in light mode
  const bgBlurBrightness = isDark ? 'brightness(0.5)' : 'brightness(0.95)';

  // 📸 Natural height layout — full image, overlayed text
  if (activeLayoutMode === 'natural_height' && hasImage) {
    return (
      <HeroNaturalHeight
        block={{ ...block, content: final }}
        cropBehavior={mobile_crop_behavior}
      />
    );
  }

  // 🧱 Full-bleed layout
  if (activeLayoutMode === 'full_bleed' && hasImage) {
    return (
      <div ref={heroRef} className={`relative w-full ${textPrimary} max-h-[90vh] overflow-hidden`}>
        {showDebug && (
          <DebugOverlay>
            {`[HeroBlock]\nLayout: full_bleed\nImage: ${image_url || 'N/A'}\nMode: ${mode}`}
          </DebugOverlay>
        )}
        <motion.div
          className="absolute inset-0 bg-fixed"
          style={{
            y,
            backgroundImage: `url(${image_url})`,
            backgroundSize: 'cover',
            backgroundPosition,
            filter: `blur(${blurPx}) ${fullBleedBrightness}`,
          }}
        />
        <div className={`absolute inset-0 ${overlayTint}`} />
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-32 pb-20 text-center sm:pt-24 sm:pb-16">
          <h1 className={`text-4xl md:text-5xl font-bold mb-4 drop-shadow ${textPrimary}`}>{headline}</h1>
          {subheadline && (
            <p className={`text-lg md:text-2xl mb-6 drop-shadow ${textPrimary}`}>{subheadline}</p>
          )}
          {cta_text && cta_link && (
            <a
              href={cta_link}
              className={`inline-block ${
                isDark ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : 'bg-purple-600 hover:bg-purple-700 text-white'
              } font-bold py-3 px-6 rounded-full transition`}
            >
              {cta_text}
            </a>
          )}
        </div>
      </div>
    );
  }

  // 🖼️ Background image layout
  if (activeLayoutMode === 'background' && hasImage) {
    return (
      <SectionShell
        compact={compact}
        className={`relative rounded-lg overflow-hidden ${textPrimary}`}
        textAlign="center"
      >
        {showDebug && (
          <DebugOverlay>
            {`[HeroBlock]\nLayout: background\nImage: ${image_url || 'N/A'}\nMode: ${mode}`}
          </DebugOverlay>
        )}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${image_url})`,
            backgroundSize: 'cover',
            backgroundPosition,
            filter: `blur(${blurPx}) ${bgBlurBrightness}`,
          }}
        />
        <div className={`absolute inset-0 ${overlayTint}`} />
        <div className="relative z-10 py-16 px-4">
          <h1 className={`text-3xl md:text-5xl font-bold mb-4 drop-shadow ${textPrimary}`}>{headline}</h1>
          {subheadline && (
            <p className={`text-lg md:text-xl mb-6 drop-shadow ${textPrimary}`}>{subheadline}</p>
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

  // 🧱 Inline layout (image optional)
  const inlineBg = isDark
    ? 'bg-neutral-900 text-white rounded-lg shadow dark:bg-neutral-950 dark:text-white'
    : 'bg-white text-black rounded-lg shadow';

  return (
    <SectionShell compact={compact} bg={inlineBg} textAlign="center">
      {showDebug && (
        <DebugOverlay>
          {`[HeroBlock]\nLayout: inline\nImage: ${hasImage ? 'yes' : 'no'}\nMode: ${mode}`}
        </DebugOverlay>
      )}
      {hasImage && (
        <img
          src={image_url}
          alt={headline || 'Hero image'}
          className="mx-auto mb-6 rounded-xl shadow max-h-96 w-full object-cover"
        />
      )}
      <h1 className={`text-3xl md:text-5xl font-bold mb-4 ${textPrimary}`}>{headline}</h1>
      {subheadline && <p className={`text-lg md:text-xl mb-6 ${textSecondary}`}>{subheadline}</p>}
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
