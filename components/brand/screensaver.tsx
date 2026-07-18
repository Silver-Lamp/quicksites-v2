'use client';

// Ambient inactivity screensaver — a full-screen image/video that fades in after a stretch of
// no input and dissolves on the next interaction. Ported from HiveJournal's fireplace
// screensaver (code + assets cleared for reuse, crosstalk 2026-07-18) and generalized to any
// asset (image or video). Inherited gotchas (kept verbatim): reduced-motion hard gate,
// muted+playsInline+autoplay+loop for mobile autoplay, mount-the-media-only-when-idle for
// battery, 700ms-in / 3000ms-out fade with immediate pointer-events-none on wake, never navigate
// on dismiss, fail-open + localStorage opt-out.

import { useEffect, useState } from 'react';
import { useInactivity } from '@/hooks/useInactivity';
import type { ResolvedScreensaver } from '@/lib/screensaver/config';

const FADE_IN_MS = 700;
const FADE_OUT_MS = 3000; // slow, calm dismiss when activity resumes

export default function Screensaver({
  config,
  /** localStorage key for the "turn off" opt-out (per surface). */
  optOutKey = 'qs_screensaver_off',
  /** Extra gate the caller controls (e.g. suppress on editor routes). Default true. */
  eligible: callerEligible = true,
}: {
  config: ResolvedScreensaver;
  optOutKey?: string;
  eligible?: boolean;
}) {
  const [optedOut, setOptedOut] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [shown, setShown] = useState(false); // opacity target (visible while idle)
  const [mounted, setMounted] = useState(false); // kept in the DOM through the fade-out tail

  // Hard gates resolve once on mount (no flash before we know).
  useEffect(() => {
    try {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) setReducedMotion(true);
      if (localStorage.getItem(optOutKey) === '1') setOptedOut(true);
    } catch {
      /* matchMedia / localStorage unavailable — fail open */
    }
    setResolved(true);
  }, [optOutKey]);

  const eligible =
    resolved && callerEligible && config.enabled && !!config.assetUrl && !optedOut && !reducedMotion;
  const { idle, wake } = useInactivity(config.idleMs, eligible);

  // Mount + fade in on idle; fade out then unmount on activity (a slow dissolve, not a snap).
  useEffect(() => {
    if (idle) {
      setMounted(true);
      const t = setTimeout(() => setShown(true), 20); // next frame → opacity 0→1
      return () => clearTimeout(t);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [idle]);

  if (!eligible || !mounted) return null;

  const turnOff = () => {
    try {
      localStorage.setItem(optOutKey, '1');
    } catch {
      /* ignore */
    }
    setOptedOut(true);
    wake();
  };

  return (
    <div
      className={`fixed inset-0 z-[9998] bg-black transition-opacity ${shown ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      style={{ transitionDuration: `${shown ? FADE_IN_MS : FADE_OUT_MS}ms` }}
      onMouseDown={wake}
      onTouchStart={wake}
      onWheel={wake}
      role="presentation"
      aria-hidden="true"
    >
      {config.assetType === 'video' ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video autoPlay loop muted playsInline className="pointer-events-none h-full w-full object-cover">
          <source src={config.assetUrl} type="video/mp4" />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={config.assetUrl} alt="" className="pointer-events-none h-full w-full object-cover" />
      )}

      {config.caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
          <span className="text-xs tracking-wide text-white/40">{config.caption}</span>
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          turnOff();
        }}
        className="absolute bottom-4 right-4 text-[11px] text-white/40 underline underline-offset-2 hover:text-white/80"
      >
        Turn off
      </button>
    </div>
  );
}
