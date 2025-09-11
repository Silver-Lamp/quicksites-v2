// components/admin/templates/render-blocks/hero.tsx
'use client';

import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import SectionShell from '@/components/ui/section-shell';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { useSafeScroll } from '@/hooks/useSafeScroll';
import DebugOverlay from '@/components/ui/debug-overlay';
import HeroNaturalHeight from './hero-natural-height';
import { useIsMobile } from '@/hooks/useIsMobile';

// on-canvas controls + palette
import HeroStageControls, { type OverlayLevel } from '@/components/admin/templates/hero/HeroStageControls';
import HeroCommandPalette, { makeHeroActions } from '@/components/admin/templates/hero/HeroCommandPalette';

type Props = {
  block: Block | undefined;
  content?: Block['content'];
  compact?: boolean;
  showDebug?: boolean;
  colorMode?: 'light' | 'dark';
  scrollRef?: React.RefObject<HTMLElement | null>;
  template?: Template;
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
  } = safeContent as any;

  // device / viewport
  const runtimeMobile = useIsMobile();
  const isTablet = device === 'tablet';
  const isMobileForced = device === 'mobile' || device === 'tablet';
  const isNarrow = isMobileForced || runtimeMobile;

  const activeLayoutModeOrig = isMobileForced ? mobile_layout_mode : layout_mode;

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

  const dbPhoneDigits = (template?.phone || '').replace(/\D/g, '');
  const resolvedPhoneDigits = (cta_phone || dbPhoneDigits || '').replace(/\D/g, '');
  const resolvedPhoneDisplay = formatPhoneDisplay(resolvedPhoneDigits);

  const action: 'jump_to_contact' | 'go_to_page' | 'call_phone' = (cta_action as any) || 'go_to_page';
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

  // layout + parallax
  const activeLayoutMode =
    (previewOnly && (isMobileForced ? mobile_layout_mode : layout_mode)) || activeLayoutModeOrig;

  const hasImage = (image_url as string)?.trim() !== '';
  const blurPx = `${blur_amount}px`;

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

  const [imagePos, setImagePos] = useState<{ x: number; y: number }>(initialPos);
  useEffect(() => setImagePos(initialPos), [initialPos.x, initialPos.y]);
  const backgroundPosition = `${Math.round(imagePos.x)}% ${Math.round(imagePos.y)}%`;

  // overlay state (preview can override)
  const [overlayLevel, setOverlayLevel] = useState<OverlayLevel>((overlay_level as OverlayLevel) || 'soft');
  const [showGrid, setShowGrid] = useState(false);

  // SAFE scroll target
  const target = (scrollRef && scrollRef.current) ? scrollRef : undefined;
  const { y: parallaxY } = useSafeScroll({ target: target as any, offset: ['start start', 'end start'] as any });
  let y: string | MotionValue<string> = '0%';
  if (activeLayoutMode === 'full_bleed' && hasImage && parallaxY) y = parallaxY;

  // tokens
  const textPrimary = isDark ? 'text-white' : 'text-black';
  const textSecondary = isDark ? 'text-white' : 'text-neutral-800';
  const titleSize = isNarrow ? 'text-3xl' : 'text-4xl md:text-5xl';
  const subSize = isNarrow ? 'text-base' : 'text-lg md:text-2xl';
  const ctaSize = isNarrow ? 'py-2 px-4 text-sm' : 'py-3 px-6';

  const CtaEl = canShowCTA ? (
    previewOnly ? (
      <span className={`inline-block ${ctaSize} ${isDark ? 'bg-yellow-400 text-black' : 'bg-purple-600 text-white'} font-bold rounded-full opacity-80 cursor-default select-none`} aria-disabled="true" role="button" tabIndex={-1}>
        {cta_text}
      </span>
    ) : (
      <a
        href={href}
        onClick={onClick}
        className={`inline-block ${ctaSize} ${isDark ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : 'bg-purple-600 hover:bg-purple-700 text-white'} font-bold rounded-full transition`}
        aria-label={action === 'call_phone' ? 'Call us now' : action === 'jump_to_contact' ? 'Jump to contact form' : 'Go to contact page'}
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

  // ---- editor patch dispatchers ----
  const dispatchFocalPatch = (pos: { x: number; y: number }) => {
    try {
      const id = (block as any)?._id || (block as any)?.id;
      if (!id) return;
      const patch = { blocks: [{ id, content: { image_x: `${Math.round(pos.x)}%`, image_y: `${Math.round(pos.y)}%` } }] };
      window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
    } catch {}
  };
  const dispatchOverlayPatch = (lvl: OverlayLevel) => {
    try {
      const id = (block as any)?._id || (block as any)?.id;
      if (!id) return;
      const patch = { blocks: [{ id, content: { overlay_level: lvl, overlay: lvl }, props: { overlay_level: lvl, overlay: lvl } }] };
      window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
    } catch {}
  };
  const dispatchLayoutPatch = (layout: string) => {
    try {
      const id = (block as any)?._id || (block as any)?.id;
      if (!id) return;
      const patch = { blocks: [{ id, content: { layout_mode: layout, layout }, props: { layout_mode: layout, layout } }] };
      window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
    } catch {}
  };

  // ---- palette & chip event bridge ----
  const [previewLayoutOverride, setPreviewLayoutOverride] = useState<string | null>(null);

  useEffect(() => {
    if (!previewOnly) return;

    const onGenericSet = (e: any) => {
      const d = e?.detail || {};
      if (d.overlay_level) {
        setOverlayLevel(d.overlay_level as OverlayLevel);
        dispatchOverlayPatch(d.overlay_level as OverlayLevel);
      }
      if (d.layout) {
        setPreviewLayoutOverride(d.layout);
        dispatchLayoutPatch(d.layout);
      }
      if (typeof d.blur_amount === 'number') {
        // simple blur patch passthrough
        try {
          const id = (block as any)?._id || (block as any)?.id;
          if (id) {
            const patch = { blocks: [{ id, content: { blur_amount: d.blur_amount }, props: { blur_amount: d.blur_amount } }] };
            window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
          }
        } catch {}
      }
    };

    const onLayout = (e: any) => {
      const next = e?.detail?.layout as string | undefined;
      if (next) { setPreviewLayoutOverride(next); dispatchLayoutPatch(next); }
    };

    const onOverlay = (e: any) => {
      const step = Math.max(-1, Math.min(1, Number(e?.detail?.step) || 0));
      const order: OverlayLevel[] = ['none','soft','strong'];
      setOverlayLevel(prev => {
        const next = order[Math.max(0, Math.min(order.length - 1, order.indexOf(prev) + step))];
        dispatchOverlayPatch(next);
        return next;
      });
    };

    const onAutoFix = () => {
      const next: OverlayLevel = overlayLevel === 'none' ? 'soft' : 'strong';
      setOverlayLevel(next);
      dispatchOverlayPatch(next);
    };

    window.addEventListener('qs:hero:set', onGenericSet as any);
    window.addEventListener('qs:hero:set-layout', onLayout as any);
    window.addEventListener('qs:hero:set-overlay', onOverlay as any);
    window.addEventListener('qs:hero:auto-fix', onAutoFix as any);

    return () => {
      window.removeEventListener('qs:hero:set', onGenericSet as any);
      window.removeEventListener('qs:hero:set-layout', onLayout as any);
      window.removeEventListener('qs:hero:set-overlay', onOverlay as any);
      window.removeEventListener('qs:hero:auto-fix', onAutoFix as any);
    };
  }, [previewOnly, overlayLevel, block]);

  // Also support data-* delegation for chip UIs rendered inside the stage
  const chipsRootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!previewOnly) return;
    const root = chipsRootRef.current;
    if (!root) return;
    const onClick = (ev: MouseEvent) => {
      let el = ev.target as HTMLElement | null;
      while (el && el !== root) {
        const ov = el.getAttribute?.('data-hero-overlay');
        const layout = el.getAttribute?.('data-hero-layout');
        const action = el.getAttribute?.('data-hero-action');
        if (ov) {
          setOverlayLevel(ov as OverlayLevel);
          dispatchOverlayPatch(ov as OverlayLevel);
          return;
        }
        if (layout) {
          setPreviewLayoutOverride(layout);
          dispatchLayoutPatch(layout);
          return;
        }
        if (action === 'auto-fix-contrast') {
          const next: OverlayLevel = overlayLevel === 'none' ? 'soft' : 'strong';
          setOverlayLevel(next);
          dispatchOverlayPatch(next);
          return;
        }
        el = el.parentElement;
      }
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [previewOnly, overlayLevel]);

  const activeLayoutModeFinal =
    (previewOnly && previewLayoutOverride) ? previewLayoutOverride : activeLayoutMode;

  // Natural height
  if (activeLayoutModeFinal === 'natural_height' && hasImage) {
    return (
      <HeroNaturalHeight
        key={renderKey}
        block={{ ...block, content: safeContent as any }}
        cropBehavior={mobile_crop_behavior}
      />
    );
  }

  // Full-bleed / Background
  const StageInner = (
    <div className={`relative z-10 max-w-6xl mx-auto px-4 ${isNarrow ? 'pt-16 pb-12' : 'pt-32 pb-20 sm:pt-24 sm:pb-16'} text-center`}>
      <h1 className={`${titleSize} font-bold mb-4 drop-shadow ${textPrimary}`}>{headline}</h1>
      {subheadline && <p className={`${subSize} mb-6 drop-shadow ${textPrimary}`}>{subheadline}</p>}
      {CtaEl}
      <PhoneLine />
    </div>
  );

  if ((activeLayoutModeFinal === 'full_bleed' || activeLayoutModeFinal === 'background') && hasImage) {
    if (previewOnly) {
      const stage = (
        <HeroStageControls
          imageUrl={image_url}
          imagePosition={imagePos}
          overlay={overlayLevel}
          showGrid={showGrid}
          onChange={(next) => {
            if (next.imagePosition) {
              setImagePos(next.imagePosition);
              dispatchFocalPatch(next.imagePosition);
            }
            if (next.overlay) { setOverlayLevel(next.overlay); dispatchOverlayPatch(next.overlay); }
            if (typeof next.showGrid === 'boolean') setShowGrid(next.showGrid);
          }}
          className={`${isDark ? 'border-white/10' : 'border-neutral-300'} ${activeLayoutModeFinal === 'full_bleed' ? 'max-h-[90vh]' : 'rounded-lg'}`}
          data-device={device || 'auto'}
        >
          {StageInner}
        </HeroStageControls>
      );

      return (
        <>
          <HeroCommandPalette actions={makeHeroActions()} />
          {activeLayoutModeFinal === 'full_bleed' ? (
            <motion.div
              key={renderKey}
              ref={chipsRootRef as any}
              className={`relative w-full ${textPrimary} overflow-hidden`}
              style={{ y }}
            >
              {showDebug && (
                <DebugOverlay>
                  {`[HeroBlock]\nLayout: ${activeLayoutModeFinal}\nImage: ${image_url || 'N/A'}\nMode: ${mode}\nDevice: ${device || 'auto'}`}
                </DebugOverlay>
              )}
              {stage}
            </motion.div>
          ) : (
            <SectionShell
              key={renderKey}
              compact={compact}
              className={`relative overflow-hidden ${textPrimary}`}
              textAlign="center"
              data-device={device || 'auto'}
            >
              {showDebug && (
                <DebugOverlay>
                  {`[HeroBlock]\nLayout: ${activeLayoutModeFinal}\nImage: ${image_url || 'N/A'}\nMode: ${mode}\nDevice: ${device || 'auto'}`}
                </DebugOverlay>
              )}
              <div ref={chipsRootRef}>
                {stage}
              </div>
            </SectionShell>
          )}
        </>
      );
    }

    // Public view (no chips)
    if (activeLayoutModeFinal === 'full_bleed') {
      return (
        <div key={renderKey} ref={(scrollRef && scrollRef.current) ? (scrollRef as any) : undefined} className={`relative w-full ${textPrimary} max-h-[90vh] overflow-hidden`} data-device={device || 'auto'}>
          {showDebug && <DebugOverlay>{`[HeroBlock]\nLayout: full_bleed`}</DebugOverlay>}
          <motion.div
            className="absolute inset-0 bg-fixed"
            style={{
              y,
              backgroundImage: `url(${image_url})`,
              backgroundSize: 'cover',
              backgroundPosition,
              filter: `blur(${blurPx}) ${isDark ? 'brightness(0.6)' : 'brightness(0.9)'}`,
            }}
          />
          <div className={`absolute inset-0 ${overlayClass(overlayLevel, isDark)}`} />
          {StageInner}
        </div>
      );
    }

    // background
    return (
      <SectionShell key={renderKey} compact={compact} className={`relative rounded-lg overflow-hidden ${textPrimary}`} textAlign="center" data-device={device || 'auto'}>
        {showDebug && <DebugOverlay>{`[HeroBlock]\nLayout: background`}</DebugOverlay>}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${image_url})`,
            backgroundSize: 'cover',
            backgroundPosition,
            filter: `blur(${blurPx}) ${isDark ? 'brightness(0.5)' : 'brightness(0.95)'}`,
          }}
        />
        <div className={`absolute inset-0 ${overlayClass(overlayLevel, isDark)}`} />
        {StageInner}
      </SectionShell>
    );
  }

  // Inline
  const inlineBg = isDark
    ? 'bg-neutral-900 text-white rounded-lg shadow dark:bg-neutral-950 dark:text-white'
    : 'bg-white text-black rounded-lg shadow';

  return (
    <SectionShell key={renderKey} compact={compact} bg={inlineBg} textAlign="center" data-device={device || 'auto'}>
      {showDebug && <DebugOverlay>{`[HeroBlock]\nLayout: inline`}</DebugOverlay>}
      {hasImage && (
        <img
          src={image_url}
          alt={headline || 'Hero image'}
          className="mx-auto mb-6 rounded-xl shadow w-full object-cover"
          style={{ objectPosition: backgroundPosition, maxHeight: isNarrow ? '16rem' : '24rem' }}
        />
      )}
      <h1 className={`${titleSize} font-bold mb-4 ${textPrimary}`}>{headline}</h1>
      {subheadline && <p className={`${subSize} mb-6 ${textSecondary}`}>{subheadline}</p>}
      {CtaEl}
      <PhoneLine />
    </SectionShell>
  );
}
