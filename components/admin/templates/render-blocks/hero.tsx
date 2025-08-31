'use client';

import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import SectionShell from '@/components/ui/section-shell';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  colorMode?: 'light' | 'dark';
  scrollRef?: React.RefObject<HTMLElement | null>;
  template?: Template;
};

/** Normalize legacy hero props -> modern content shape */
function normalizeHeroContent(raw: any | null | undefined) {
  if (!raw || typeof raw !== 'object') return null;
  // Already in new shape?
  const looksNew =
    'headline' in raw ||
    'subheadline' in raw ||
    'cta_text' in raw ||
    'cta_link' in raw ||
    'image_url' in raw;
  if (looksNew) return raw;

  // Legacy -> New mapping
  const mapped: any = {
    headline: raw.heading ?? '',
    subheadline: raw.subheading ?? '',
    cta_text: raw.ctaLabel ?? '',
    cta_link: raw.ctaHref ?? '',
    image_url: raw.heroImage ?? raw.image_url ?? '',
    layout_mode: raw.layout_mode ?? 'inline',
    mobile_layout_mode: raw.mobile_layout_mode ?? 'inline',
    mobile_crop_behavior: raw.mobile_crop_behavior ?? 'cover',
    blur_amount: raw.blur_amount ?? 0,
    parallax_enabled: raw.parallax_enabled ?? false,
    image_position: raw.image_position ?? 'center',
    image_x: raw.image_x,
    image_y: raw.image_y,
    // optional legacy extras:
    cta_action: raw.cta_action,
    cta_phone: raw.cta_phone,
    contact_anchor_id: raw.contact_anchor_id,
    cta_show_phone_below: raw.cta_show_phone_below,
  };

  return mapped;
}

function formatPhoneDisplay(digits: string) {
  const d = digits.replace(/\D/g, '');
  if (d.length !== 10) return digits;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function HeroRender({
  block,
  content,
  compact = false,
  showDebug = false,
  colorMode,
  scrollRef,
  template,
}: Props) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const targetRef = (scrollRef as React.RefObject<HTMLElement | null>) ?? (localRef as any);

  // --- Accept new OR legacy data sources ---
  const rawFromBlock = (block as any)?.content ?? (block as any)?.props;
  const safeContent = normalizeHeroContent(content ?? rawFromBlock);

  const [detectedMode, setDetectedMode] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    if (colorMode) return;
    if (typeof document !== 'undefined') {
      setDetectedMode(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    }
  }, [colorMode]);
  const mode = colorMode ?? detectedMode;
  const isDark = mode === 'dark';

  if (!block || !safeContent) {
    if (showDebug) console.warn('[⚠️ HeroRender] Missing block content; got:', { block, content });
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
    cta_link,          // legacy / go_to_page url
    cta_action,        // 'jump_to_contact' | 'go_to_page' | 'call_phone'
    cta_phone,         // optional override
    contact_anchor_id, // for jump
    cta_show_phone_below, // boolean to print phone beneath button
    image_url,
    layout_mode = 'inline',
    mobile_layout_mode = 'inline',
    mobile_crop_behavior = 'cover',
    blur_amount = 8,
    image_position,
    image_x,
    image_y,
  } = safeContent as any;

  // ---- CTA resolution (no conditional hooks) ----
  const contactAnchor = (contact_anchor_id || 'contact').toString();
  const handleJumpClick = useCallback<React.MouseEventHandler<HTMLAnchorElement>>(
    (e) => {
      const el = document.getElementById(contactAnchor);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [contactAnchor]
  );

  const dbPhoneDigits = (template?.phone || '').replace(/\D/g, '');
  const resolvedPhoneDigits = (cta_phone || dbPhoneDigits || '').replace(/\D/g, '');
  const resolvedPhoneDisplay = formatPhoneDisplay(resolvedPhoneDigits);

  const action: 'jump_to_contact' | 'go_to_page' | 'call_phone' =
    (cta_action as any) || 'go_to_page';

  let href: string | undefined;
  let onClick: React.MouseEventHandler<HTMLAnchorElement> | undefined;

  if (action === 'jump_to_contact') {
    href = `#${contactAnchor}`;
    onClick = handleJumpClick;
  } else if (action === 'call_phone') {
    href = resolvedPhoneDigits ? `tel:${resolvedPhoneDigits}` : undefined;
  } else {
    href = cta_link || '/contact';
  }

  const canShowCTA = !!cta_text && !!href;

  // ---- layout + parallax ----
  const isMobile = useIsMobile();
  const activeLayoutMode =
    typeof window === 'undefined' ? layout_mode : (isMobile ? mobile_layout_mode : layout_mode);

  const hasImage = (image_url as string)?.trim() !== '';
  const blurPx = `${blur_amount}px`;
  const backgroundPosition =
    image_x && image_y ? `${image_x} ${image_y}` : image_position || 'center';

  const [refReady, setRefReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRefReady(!!targetRef?.current));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scroll = useSafeScroll({
    target: targetRef as any,
    offset: ['start start', 'end start'] as any,
  });

  let y: string | MotionValue<string> = '0%';
  if (activeLayoutMode === 'full_bleed' && hasImage && (scroll as any)?.y) {
    y = (scroll as any).y;
  }

  // theme tokens
  const textPrimary = isDark ? 'text-white' : 'text-black';
  const textSecondary = isDark ? 'text-white' : 'text-neutral-800';
  const overlayTint = isDark ? 'bg-black/40' : 'bg-white/40';
  const fullBleedBrightness = isDark ? 'brightness(0.6)' : 'brightness(0.9)';
  const bgBlurBrightness = isDark ? 'brightness(0.5)' : 'brightness(0.95)';

  const PhoneLine = () =>
    cta_show_phone_below && resolvedPhoneDigits ? (
      <div className={`mt-2 text-sm ${isDark ? 'text-white/85' : 'text-neutral-700'}`}>
        <a href={`tel:${resolvedPhoneDigits}`} className="underline-offset-2 hover:underline">
          {resolvedPhoneDisplay}
        </a>
      </div>
    ) : null;

  // 📸 Natural height layout
  if (activeLayoutMode === 'natural_height' && hasImage) {
    return (
      <HeroNaturalHeight
        block={{ ...block, content: safeContent as any }}
        cropBehavior={mobile_crop_behavior}
      />
    );
  }

  // 🧱 Full-bleed layout
  if (activeLayoutMode === 'full_bleed' && hasImage) {
    return (
      <div ref={targetRef as any} className={`relative w-full ${textPrimary} max-h-[90vh] overflow-hidden`}>
        {showDebug && (
          <DebugOverlay>
            {`[HeroBlock]
Layout: full_bleed
Image: ${image_url || 'N/A'}
Mode: ${mode}
CTA: ${action}${action === 'call_phone' ? ` (${resolvedPhoneDigits || 'no-phone'})` : ''}`}
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
          {canShowCTA && (
            <>
              <a
                href={href}
                onClick={onClick}
                className={`inline-block ${
                  isDark ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : 'bg-purple-600 hover:bg-purple-700 text-white'
                } font-bold py-3 px-6 rounded-full transition`}
                aria-label={
                  action === 'call_phone'
                    ? 'Call us now'
                    : action === 'jump_to_contact'
                    ? 'Jump to contact form'
                    : 'Go to contact page'
                }
              >
                {cta_text}
              </a>
              <PhoneLine />
            </>
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
            {`[HeroBlock]
Layout: background
Image: ${image_url || 'N/A'}
Mode: ${mode}
CTA: ${action}${action === 'call_phone' ? ` (${resolvedPhoneDigits || 'no-phone'})` : ''}`}
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
          {canShowCTA && (
            <>
              <a
                href={href}
                onClick={onClick}
                className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-full transition"
                aria-label={
                  action === 'call_phone'
                    ? 'Call us now'
                    : 'Jump to contact form'
                }
              >
                {cta_text}
              </a>
              <PhoneLine />
            </>
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
          {`[HeroBlock]
Layout: inline
Image: ${hasImage ? 'yes' : 'no'}
Mode: ${mode}
CTA: ${action}${action === 'call_phone' ? ` (${resolvedPhoneDigits || 'no-phone'})` : ''}`}
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
      {canShowCTA && (
        <>
          <a
            href={href}
            onClick={onClick}
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-full transition"
            aria-label={
              action === 'call_phone'
                ? 'Call us now'
                : action === 'jump_to_contact'
                ? 'Jump to contact form'
                : 'Go to contact page'
            }
          >
            {cta_text}
          </a>
          <PhoneLine />
        </>
      )}
    </SectionShell>
  );
}
