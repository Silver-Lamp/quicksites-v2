'use client';

import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import SectionShell from '@/components/ui/section-shell';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  previewOnly?: boolean; // ← if true, no real navigation
};

/* --------------------------- helpers --------------------------- */

// legacy → new shape
function normalizeHeroContent(raw: any | null | undefined) {
  if (!raw || typeof raw !== 'object') return null;
  const looksNew =
    'headline' in raw ||
    'subheadline' in raw ||
    'cta_text' in raw ||
    'cta_link' in raw ||
    'image_url' in raw;
  if (looksNew) return raw;

  const m: any = {
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
    // optional extras passed through:
    cta_action: raw.cta_action,
    cta_phone: raw.cta_phone,
    contact_anchor_id: raw.contact_anchor_id,
    cta_show_phone_below: raw.cta_show_phone_below,
  };
  return m;
}

/** Prefer the “most edited” hero between props vs content, then fill blanks from the other */
function selectHeroContent(propsRaw: any, contentRaw: any) {
  const fromProps = normalizeHeroContent(propsRaw) || {};
  const fromContent = normalizeHeroContent(contentRaw) || {};

  const isStr = (v: any) => typeof v === 'string' && v.trim().length > 0;
  const isDefault = (s: string) =>
    !isStr(s) || /^welcome to your new site$/i.test((s || '').trim());

  const score = (c: any) => {
    let s = 0;
    if (!isDefault(c.headline ?? '')) s += 3;
    if (isStr(c.subheadline)) s += 1;
    if (isStr(c.cta_text)) s += 1;
    return s;
  };

  const sP = score(fromProps);
  const sC = score(fromContent);

  const base = sC >= sP ? fromContent : fromProps;
  const other = sC >= sP ? fromProps : fromContent;

  const merged: any = { ...base };
  for (const [k, v] of Object.entries(other)) {
    const cur = (merged as any)[k];
    if (cur == null || cur === '' || (typeof cur === 'number' && Number.isNaN(cur))) {
      (merged as any)[k] = v;
    }
  }

  // derive action if missing (from cta_link)
  if (!merged.cta_action && typeof merged.cta_link === 'string') {
    const link = merged.cta_link;
    if (link.startsWith('#')) merged.cta_action = 'jump_to_contact';
    else if (link.startsWith('tel:')) merged.cta_action = 'call_phone';
    else merged.cta_action = 'go_to_page';
  }

  return merged;
}

function formatPhoneDisplay(digits: string) {
  const d = digits.replace(/\D/g, '');
  if (d.length !== 10) return digits;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/* --------------------------- component --------------------------- */

export default function HeroRender({
  block,
  content,
  compact = false,
  showDebug = false,
  colorMode,
  scrollRef,
  template, 
  previewOnly = false,
}: Props) {
  // Choose best of props/content and merge
  const rawProps = (block as any)?.props;
  const rawContent = content ?? (block as any)?.content;
  const safeContent = useMemo(() => selectHeroContent(rawProps, rawContent), [rawProps, rawContent]);

  // 🔑 Force a re-mount when meaningful text changes (covers stubborn memoization higher up)
  const renderKey = useMemo(
    () =>
      [
        (block as any)?._id ?? (block as any)?.id ?? 'hero',
        safeContent?.headline ?? '',
        safeContent?.subheadline ?? '',
        safeContent?.cta_text ?? '',
      ].join('|'),
    [block, safeContent?.headline, safeContent?.subheadline, safeContent?.cta_text]
  );

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
      <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded" key={renderKey}>
        Invalid hero block
      </div>
    );
  }

  const {
    headline,
    subheadline,
    cta_text,
    cta_link,
    cta_action,
    cta_phone,
    contact_anchor_id,
    cta_show_phone_below,
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

  // Respect previewOnly: do not navigate in editors
  const action: 'jump_to_contact' | 'go_to_page' | 'call_phone' =
    (cta_action as any) || 'go_to_page';
  let href: string | undefined;
  let onClick: React.MouseEventHandler<HTMLAnchorElement> | undefined;

  if (previewOnly) {
    href = undefined; onClick = (e) => e.preventDefault();
  } else {
    if (action === 'jump_to_contact') { href = `#${contactAnchor}`; onClick = handleJumpClick; }
    else if (action === 'call_phone') { href = resolvedPhoneDigits ? `tel:${resolvedPhoneDigits}` : undefined; }
    else { href = cta_link || '/contact'; }
  }

  const canShowCTA = !!cta_text && (!!href || previewOnly);

  // ---- layout + parallax ----
  const isMobile = useIsMobile();
  const activeLayoutMode =
    typeof window === 'undefined' ? layout_mode : (isMobile ? mobile_layout_mode : layout_mode);

  const hasImage = (image_url as string)?.trim() !== '';
  const blurPx = `${blur_amount}px`;
  const backgroundPosition =
    image_x && image_y ? `${image_x} ${image_y}` : image_position || 'center';

  // SAFE scroll target: pass undefined until scrollRef is mounted
  const target = (scrollRef && scrollRef.current) ? scrollRef : undefined;
  const { y: parallaxY } = useSafeScroll({ target: target as any, offset: ['start start', 'end start'] as any });

  let y: string | MotionValue<string> = '0%';
  if (activeLayoutMode === 'full_bleed' && hasImage && parallaxY) y = parallaxY;

  // theme tokens
  const textPrimary = isDark ? 'text-white' : 'text-black';
  const textSecondary = isDark ? 'text-white' : 'text-neutral-800';
  const overlayTint = isDark ? 'bg-black/40' : 'bg-white/40';
  const fullBleedBrightness = isDark ? 'brightness(0.6)' : 'brightness(0.9)';
  const bgBlurBrightness = isDark ? 'brightness(0.5)' : 'brightness(0.95)';

  // CTA element (preview-safe)
  const CtaEl = canShowCTA ? (
    previewOnly ? (
      <span
        className={`inline-block ${isDark ? 'bg-yellow-400 text-black' : 'bg-purple-600 text-white'} font-bold py-3 px-6 rounded-full opacity-80 cursor-default select-none`}
        aria-disabled="true"
        role="button"
        tabIndex={-1}
      >
        {cta_text}
      </span>
    ) : (
      <a
        href={href}
        onClick={onClick}
        className={`inline-block ${isDark ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : 'bg-purple-600 hover:bg-purple-700 text-white'} font-bold py-3 px-6 rounded-full transition`}
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
    )
  ) : null;

  const PhoneLine = () =>
    cta_show_phone_below && resolvedPhoneDigits ? (
      previewOnly ? (
        <div className={`mt-2 text-sm ${isDark ? 'text-white/85' : 'text-neutral-700'}`}>{resolvedPhoneDisplay}</div>
      ) : (
        <div className={`mt-2 text-sm ${isDark ? 'text-white/85' : 'text-neutral-700'}`}>
          <a href={`tel:${resolvedPhoneDigits}`} className="underline-offset-2 hover:underline">
            {resolvedPhoneDisplay}
          </a>
        </div>
      )
    ) : null;

  // 📸 Natural height layout
  if (activeLayoutMode === 'natural_height' && hasImage) {
    return (
      <HeroNaturalHeight
        key={renderKey}
        block={{ ...block, content: safeContent as any }}
        cropBehavior={mobile_crop_behavior}
      />
    );
  }

  // 🧱 Full-bleed
  if (activeLayoutMode === 'full_bleed' && hasImage) {
    return (
      <div
        key={renderKey}
        ref={(scrollRef && scrollRef.current) ? (scrollRef as any) : undefined}
        className={`relative w-full ${textPrimary} max-h-[90vh] overflow-hidden`}
      >
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
          {subheadline && <p className={`text-lg md:text-2xl mb-6 drop-shadow ${textPrimary}`}>{subheadline}</p>}
          {CtaEl}
          <PhoneLine />
        </div>
      </div>
    );
  }

  // 🖼️ Background
  if (activeLayoutMode === 'background' && hasImage) {
    return (
      <SectionShell
        key={renderKey}
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
          {subheadline && <p className={`text-lg md:text-xl mb-6 drop-shadow ${textPrimary}`}>{subheadline}</p>}
          {CtaEl}
          <PhoneLine />
        </div>
      </SectionShell>
    );
  }

  // 🧱 Inline
  const inlineBg = isDark
    ? 'bg-neutral-900 text-white rounded-lg shadow dark:bg-neutral-950 dark:text-white'
    : 'bg-white text-black rounded-lg shadow';

  return (
    <SectionShell key={renderKey} compact={compact} bg={inlineBg} textAlign="center">
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
      {CtaEl}
      <PhoneLine />
    </SectionShell>
  );
}
