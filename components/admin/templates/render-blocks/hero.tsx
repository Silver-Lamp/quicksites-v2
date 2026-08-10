'use client';

import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import SectionShell from '@/components/ui/section-shell';
import PainterlyBackdrop from '@/components/site/painterly-backdrop';
import { heroBackdropFor } from '@/lib/sites/heroBackdrop';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { useSafeScroll } from '@/hooks/useSafeScroll';
import DebugOverlay from '@/components/ui/debug-overlay';
import HeroNaturalHeight from './hero-natural-height';
import { useIsMobile } from '@/hooks/useIsMobile';

type OverlayLevel = 'none' | 'soft' | 'strong';

type Props = {
  block: Block | undefined;
  content?: Block['content'];
  compact?: boolean;
  showDebug?: boolean;
  colorMode?: 'light' | 'dark';
  scrollRef?: React.RefObject<HTMLElement | null>;
  template?: Template;
  /** When true, links/CTAs are disabled—but visuals are identical to public render. */
  previewOnly?: boolean;
  device?: 'mobile' | 'tablet' | 'desktop';
};

/* --------------------------- helpers --------------------------- */

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
    layout_mode: raw.layout_mode ?? raw.layout ?? 'inline',
    mobile_layout_mode: raw.mobile_layout_mode ?? 'inline',
    mobile_crop_behavior: raw.mobile_crop_behavior ?? 'cover',
    blur_amount: raw.blur_amount ?? 0,
    parallax_enabled: raw.parallax_enabled ?? false,
    image_position: raw.image_position ?? 'center',
    image_x: raw.image_x,
    image_y: raw.image_y,
    overlay_level: raw.overlay_level ?? raw.overlay ?? 'soft',
  };
  return m;
}

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

  if (!merged.cta_action && typeof merged.cta_link === 'string') {
    const link = merged.cta_link.trim();
    // ⚠️ AN IN-PAGE ANCHOR IS NOT AUTOMATICALLY THE CONTACT FORM. This mapped EVERY `#…` link to
    // `jump_to_contact`, which then throws the link away and scrolls to `#contact` — so a hero
    // reading "Browse restaurants → #restaurants" landed on the contact form, as did every
    // "See the menu", "Our services", "Read the FAQ". The button worked, went somewhere, and
    // went somewhere wrong, which is why it survived: nothing errors when a CTA lies.
    if (link === '#' || link === '#contact') merged.cta_action = 'jump_to_contact';
    else if (link.startsWith('#')) merged.cta_action = 'jump_to_anchor';
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

function toPercent(v?: string, axis: 'x' | 'y' = 'x') {
  if (!v) return 50;
  const t = String(v).trim().toLowerCase();
  if (t.endsWith('%')) {
    const n = parseFloat(t.replace('%', ''));
    return isNaN(n) ? 50 : Math.max(0, Math.min(100, n));
  }
  if (axis === 'x') {
    if (t === 'left') return 0;
    if (t === 'center' || t === 'middle') return 50;
    if (t === 'right') return 100;
  } else {
    if (t === 'top') return 0;
    if (t === 'center' || t === 'middle') return 50;
    if (t === 'bottom') return 100;
  }
  return 50;
}

function overlayClass(level: OverlayLevel, isDark: boolean) {
  if (level === 'none') return 'bg-transparent';
  if (level === 'strong') return isDark ? 'bg-black/60' : 'bg-white/60';
  return isDark ? 'bg-black/35' : 'bg-white/35';
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
  device,
}: Props) {
  const rawProps = (block as any)?.props;
  const rawContent = content ?? (block as any)?.content;
  const safeContent = useMemo(() => selectHeroContent(rawProps, rawContent), [rawProps, rawContent]);

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
    overlay_level = 'soft',
    hide_headline = false,
    hide_subheadline = false,
    hide_cta = false,
  } = safeContent as any;

  // device / viewport
  const runtimeMobile = useIsMobile();
  const isMobileForced = device === 'mobile' || device === 'tablet';
  const isNarrow = isMobileForced || runtimeMobile;

  const activeLayoutMode = isMobileForced ? mobile_layout_mode : layout_mode;

  // CTA
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

  /** Smooth-scroll to the anchor the author actually named. */
  const handleAnchorClick = useCallback<React.MouseEventHandler<HTMLAnchorElement>>(
    (e) => {
      const id = String(cta_link || '').replace(/^#/, '');
      const el = id ? document.getElementById(id) : null;
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [cta_link]
  );

  const dbPhoneDigits = (template?.phone || '').replace(/\D/g, '');
  const resolvedPhoneDigits = (cta_phone || dbPhoneDigits || '').replace(/\D/g, '');
  const resolvedPhoneDisplay = formatPhoneDisplay(resolvedPhoneDigits);

  const action: 'jump_to_contact' | 'jump_to_anchor' | 'go_to_page' | 'call_phone' =
    (cta_action as any) || 'go_to_page';
  let href: string | undefined;
  let onClick: React.MouseEventHandler<HTMLAnchorElement> | undefined;

  if (previewOnly) {
    href = undefined;
    onClick = (e) => e.preventDefault();
  } else {
    if (action === 'jump_to_contact') {
      href = `#${contactAnchor}`;
      onClick = handleJumpClick;
    } else if (action === 'jump_to_anchor') {
      // The author's own anchor, kept. Falls back to a plain href if the id isn't on the page,
      // so a mistyped anchor does nothing visible rather than silently going somewhere else.
      href = cta_link;
      onClick = handleAnchorClick;
    } else if (action === 'call_phone') {
      href = resolvedPhoneDigits ? `tel:${resolvedPhoneDigits}` : undefined;
    } else {
      href = cta_link || '/contact';
    }
  }

  const canShowCTA = !hide_cta && !!cta_text && (!!href || previewOnly);

  // layout + parallax
  // ⚠️ THIS WAS TRUE FOR EVERY HERO WITH A NULL IMAGE. Optional chaining on a null returns
  // `undefined`, and `undefined !== ''` is TRUE — so a hero with no image reported having one,
  // took the background/full-bleed layout, and painted `backgroundImage: url(undefined)`: a blank
  // slab, no error, no warning. It also meant such a hero never reached the inline branch, which
  // is where the painterly backdrop lives, so the apex hero silently opted out of its own theme.
  // The empty-string case was handled; the null case is the one the fleet actually has.
  const hasImage = typeof image_url === 'string' && image_url.trim() !== '';
  const blurPx = `${blur_amount}px`;
  const blurFilter = blur_amount > 0 ? `blur(${blurPx})` : 'none';

  // SAFE scroll target
  const target = (scrollRef && scrollRef.current) ? scrollRef : undefined;
  const { y: parallaxY } = useSafeScroll({ target: target as any, offset: ['start start', 'end start'] as any });
  let y: string | MotionValue<string> = '0%';
  if (activeLayoutMode === 'full_bleed' && hasImage && parallaxY) y = parallaxY;

  // background position
  const initialPos = useMemo(() => {
    if (image_x || image_y) {
      return { x: toPercent(image_x, 'x'), y: toPercent(image_y, 'y') };
    }
    if (typeof image_position === 'string') {
      const parts = image_position.split(/[\s]+/);
      return { x: toPercent(parts[0], 'x'), y: toPercent(parts[1] || 'center', 'y') };
    }
    return { x: 50, y: 50 };
  }, [image_x, image_y, image_position]);
  const backgroundPosition = `${Math.round(initialPos.x)}% ${Math.round(initialPos.y)}%`;

  // tokens
  const textPrimary = isDark ? 'text-white' : 'text-black';
  const textSecondary = isDark ? 'text-white' : 'text-neutral-800';
  const titleSize = isNarrow ? 'text-3xl' : 'text-4xl md:text-5xl';
  const subSize = isNarrow ? 'text-base' : 'text-lg md:text-2xl';
  const ctaSize = isNarrow ? 'py-2 px-4 text-sm' : 'py-3 px-6';

  const CtaEl = canShowCTA ? (
    previewOnly ? (
      <span
        className={`inline-block ${ctaSize} bg-primary text-primary-foreground font-bold rounded-full opacity-80 cursor-default select-none`}
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
        className={`inline-block ${ctaSize} bg-primary hover:opacity-90 text-primary-foreground font-bold rounded-full transition`}
        aria-label={
          action === 'call_phone'
            ? 'Call us now'
            : action === 'jump_to_contact'
            ? 'Jump to contact form'
            : action === 'jump_to_anchor'
            ? undefined // the link text already says where it goes
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
        <div className="mt-2 text-lg text-muted-foreground">{resolvedPhoneDisplay}</div>
      ) : (
        <div className="mt-2 text-lg text-muted-foreground">
          <a href={`tel:${resolvedPhoneDigits}`} className="underline-offset-2 hover:underline">
            {resolvedPhoneDisplay}
          </a>
        </div>
      )
    ) : null;

  // Natural height
  if (activeLayoutMode === 'natural_height' && hasImage) {
    return (
      <HeroNaturalHeight
        key={renderKey}
        block={{ ...block, content: safeContent as any }}
        cropBehavior={mobile_crop_behavior}
      />
    );
  }

  // Stage inner shared UI
  const StageInner = (
    <div
      className={`relative z-10 max-w-6xl mx-auto px-4 ${
        isNarrow ? 'pt-16 pb-12' : 'pt-32 pb-20 sm:pt-24 sm:pb-16'
      } text-center`}
    >
      {!hide_headline && headline && (
        <h1 className={`${titleSize} font-bold mb-4 drop-shadow ${textPrimary}`}>{headline}</h1>
      )}
      {!hide_subheadline && subheadline && (
        <p className={`${subSize} mb-6 drop-shadow ${textPrimary}`}>{subheadline}</p>
      )}
      {CtaEl}
      <PhoneLine />
    </div>
  );

  // Full-bleed / Background
  if ((activeLayoutMode === 'full_bleed' || activeLayoutMode === 'background') && hasImage) {
    if (activeLayoutMode === 'full_bleed') {
      return (
        <div
          key={renderKey}
          ref={(scrollRef && scrollRef.current) ? (scrollRef as any) : undefined}
          className={`relative w-full ${textPrimary} max-h-[90vh] overflow-hidden`}
          data-device={device || 'auto'}
        >
          {showDebug && <DebugOverlay>{`[HeroBlock]\nLayout: full_bleed`}</DebugOverlay>}
          <motion.div
            className="absolute inset-0 bg-fixed"
            style={{
              y,
              backgroundImage: `url(${image_url})`,
              backgroundSize: 'cover',
              backgroundPosition,
              filter: blurFilter,
            }}
          />
          {overlay_level !== 'none' && (
            <div className={`absolute inset-0 ${overlayClass(overlay_level as OverlayLevel, isDark)}`} />
          )}
          {StageInner}
        </div>
      );
    }

    // background (boxed)
    return (
      <SectionShell
        key={renderKey}
        compact={compact}
        className={`relative rounded-lg overflow-hidden ${textPrimary}`}
        textAlign="center"
        data-device={device || 'auto'}
      >
        {showDebug && <DebugOverlay>{`[HeroBlock]\nLayout: background`}</DebugOverlay>}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${image_url})`,
            backgroundSize: 'cover',
            backgroundPosition,
            filter: blurFilter,
          }}
        />
        {overlay_level !== 'none' && (
          <div className={`absolute inset-0 ${overlayClass(overlay_level as OverlayLevel, isDark)}`} />
        )}
        {StageInner}
      </SectionShell>
    );
  }

  // Inline — semantic surface so the site's neutral palette (or the light/dark
  // baseline on legacy sites) drives it instead of hardcoded neutral/white.
  const inlineBg = 'bg-card text-card-foreground rounded-lg shadow';

  // ⚠️ THE PORTFOLIO HERO, AND ITS NULL PATH FIRST. `portfolioHeroBackdrop` returns null for every
  // business site, for a person who opted out, and for an unpainted asset — in all three the hero
  // below renders exactly as it always did. Rule 7: the decoration can be absent and nothing about
  // the page depends on it. The backdrop only replaces the card surface when there IS a painting,
  // because a transparent hero over no image is just an unstyled hero.
  const heroBackdrop = heroBackdropFor((template as any)?.data ?? template);

  return (
    <SectionShell
      key={renderKey}
      compact={compact}
      bg={heroBackdrop ? 'rounded-lg overflow-hidden' : inlineBg}
      textAlign="center"
      data-device={device || 'auto'}
      className="relative"
    >
      {heroBackdrop && (
        <PainterlyBackdrop
          src={heroBackdrop.src}
          opacity={heroBackdrop.opacity}
          scrim={heroBackdrop.scrim}
        />
      )}
      {/* Shimmer while a guest site auto-generates its hero image (CSS-gated on
          html[data-qs-autogen] — invisible on normal renders). */}
      {!hasImage && <div className="qs-hero-shimmer" aria-hidden />}
      <div className="relative z-10">
        {showDebug && <DebugOverlay>{`[HeroBlock]\nLayout: inline`}</DebugOverlay>}
        {hasImage && (
          <img
            src={image_url}
            alt={headline || 'Hero image'}
            className="mx-auto mb-6 rounded-xl shadow w-full object-cover"
            style={{ objectPosition: backgroundPosition, maxHeight: isNarrow ? '16rem' : '24rem' }}
          />
        )}
        {!hide_headline && headline && (
          <h1
            className={`${titleSize} font-bold mb-4 ${
              heroBackdrop ? 'text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]' : 'text-card-foreground'
            }`}
          >
            {headline}
          </h1>
        )}
        {/* ⚠️ `text-muted-foreground` OVER A PAINTING IS THE CONTRAST BUG THE RENDER GATE EXISTS
            TO CATCH. Muted is defined against a flat card surface; over a sunlit wall it is grey
            on grey, and the subheadline is where the "available for contract work" line lives —
            the one sentence on a portfolio that has to be read. Both hero lines get an explicit
            light colour and a shadow when there IS a backdrop, and keep the semantic tokens when
            there is not (rule 7: the no-backdrop path stays exactly as it was). */}
        {!hide_subheadline && subheadline && (
          <p
            className={`${subSize} mb-6 ${
              heroBackdrop ? 'text-zinc-100 drop-shadow-[0_1px_8px_rgba(0,0,0,0.75)]' : 'text-muted-foreground'
            }`}
          >
            {subheadline}
          </p>
        )}
        {CtaEl}
        <PhoneLine />
      </div>
    </SectionShell>
  );
}
