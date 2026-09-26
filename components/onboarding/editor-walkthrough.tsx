'use client';

// components/onboarding/editor-walkthrough.tsx
//
// The first-run editor walkthrough: a spotlight on one control at a time, five steps.
//
// ⚠️ IT SKIPS A STEP WHOSE ANCHOR IS NOT ON THE PAGE, rather than showing an empty tooltip or
// stalling. Controls come and go with role and state — a guest has no Publish, a narrow viewport
// collapses the tray — and a tour that halts on something it cannot point at is worse than one
// step shorter. The alternative (assume every anchor exists) fails silently and only in the
// configurations nobody screenshots.
//
// ⚠️ IT NEVER TRAPS ANYONE. Escape closes it, the backdrop closes it, and "Skip" is on every
// step. It also marks itself seen on ANY exit, not only on finishing — someone who escapes out
// has told us they do not want it, and showing it again next login would be the nag this is
// supposed to replace.
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { WALKTHROUGH_STEPS, type WalkthroughStep } from '@/lib/onboarding/walkthrough';

/**
 * ⚠️ MAX 32-BIT INT, AND IT HAS TO BE — the editor chrome already lives up here.
 *
 * The first cut used `z-[80]`, which put the whole overlay UNDER the page manager
 * (`z-[2147483646]`) and the action toolbar (`z-[2147483647]`). Step 1 looked perfect because its
 * card sits high on the page with nothing above it; step 2 anchors near the bottom, so the card
 * rendered *behind* the Pages panel and only the button row poked out below it — which reads as a
 * theming bug and is really a stacking one.
 *
 * ⚠️ We cannot outrank the toolbar numerically, because it is already at the maximum. Equal
 * z-index is resolved by DOM order, and this portal is appended to <body> when the walkthrough
 * OPENS — after the toolbar has mounted — so it wins. That is a real dependency on mount order
 * rather than a guarantee: if a future overlay renders at max-int *after* this one, it will cover
 * the card, and the fix then is to lower the toolbar rather than to invent a bigger number.
 *
 * Leaving the toolbar bright is deliberate, not a side effect: on the theme and publish steps the
 * toolbar IS the thing being pointed at, so it should sit above the dimmed backdrop.
 */
const OVERLAY_Z = 'z-[2147483647]';

type Rect = { top: number; left: number; width: number; height: number };

function rectFor(anchor: string): Rect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(`[data-tour="${anchor}"]`);
  if (!el) return null;
  const r = (el as HTMLElement).getBoundingClientRect();
  // A zero-size box is present-but-not-rendered (collapsed tray, hidden panel) — treat it as
  // absent, or the spotlight lands on a 0x0 point in the corner.
  if (r.width < 4 || r.height < 4) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function EditorWalkthrough({ onDone }: { onDone: () => void }) {
  // Only steps whose anchor is actually on the page, resolved once at open.
  const [steps, setSteps] = useState<WalkthroughStep[]>([]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    const present = WALKTHROUGH_STEPS.filter((s) => rectFor(s.anchor));
    setSteps(present);
    if (present.length === 0) onDone(); // nothing to point at — do not show an empty tour
  }, [onDone]);

  const step = steps[i];

  // Re-measure on scroll/resize: the tray is fixed, the canvas is not, and a spotlight that does
  // not follow its target is worse than none.
  useLayoutEffect(() => {
    if (!step) return;
    const measure = () => setRect(rectFor(step.anchor));
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  const finish = useCallback(() => onDone(), [onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [finish, steps.length]);

  if (!mounted || !step || !rect) return null;

  const pad = 8;
  const boxTop = rect.top - pad;
  const boxLeft = rect.left - pad;
  const boxW = rect.width + pad * 2;
  const boxH = rect.height + pad * 2;

  // Put the card below the target, or above it when there is no room underneath.
  const below = boxTop + boxH + 190 < window.innerHeight;
  const cardTop = below ? boxTop + boxH + 12 : Math.max(12, boxTop - 12 - 180);
  const cardLeft = Math.min(Math.max(12, boxLeft), Math.max(12, window.innerWidth - 360));

  const isLast = i === steps.length - 1;

  return createPortal(
    <div className={`fixed inset-0 ${OVERLAY_Z}`} role="dialog" aria-modal="true" aria-label="Editor walkthrough">
      {/* Backdrop with a hole punched over the target. Four panels rather than an SVG mask —
          fewer moving parts, and it degrades to "slightly dim" rather than "black screen" if a
          measurement is off. */}
      <div className="absolute inset-x-0 top-0 bg-black/60" style={{ height: Math.max(0, boxTop) }} onClick={finish} />
      <div className="absolute inset-x-0 bg-black/60" style={{ top: boxTop + boxH, bottom: 0 }} onClick={finish} />
      <div className="absolute bg-black/60" style={{ top: boxTop, left: 0, width: Math.max(0, boxLeft), height: boxH }} onClick={finish} />
      <div className="absolute bg-black/60" style={{ top: boxTop, left: boxLeft + boxW, right: 0, height: boxH }} onClick={finish} />

      <div
        aria-hidden
        className="pointer-events-none absolute rounded-lg ring-2 ring-sky-400"
        style={{ top: boxTop, left: boxLeft, width: boxW, height: boxH }}
      />

      <div
        className="absolute w-[340px] rounded-xl border border-sky-500/40 bg-zinc-950 p-4 shadow-2xl"
        style={{ top: cardTop, left: cardLeft }}
      >
        <div className="text-xs font-medium uppercase tracking-wide text-sky-300">
          Step {i + 1} of {steps.length}
        </div>
        <h3 className="mt-1 text-base font-semibold text-white">{step.title}</h3>
        <p className="mt-1.5 text-sm text-zinc-300">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          {/* ⚠️ Always reachable. A tour you cannot leave is a modal with extra steps. */}
          <button type="button" onClick={finish} className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
            Skip
          </button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI(i - 1)}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? finish() : setI(i + 1))}
              className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-medium text-zinc-950 transition hover:bg-sky-400"
            >
              {isLast ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
