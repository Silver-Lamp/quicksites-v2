import { useEffect, useRef, useState } from 'react';

/**
 * Fires `idle: true` after `delayMs` of no user input, resetting on any activity (mouse, key,
 * touch, wheel, scroll). Powers the inactivity screensaver, but is generic.
 *
 * Ported from HiveJournal (cleared for reuse, crosstalk 2026-07-18) — same behavior:
 * - Pass `enabled: false` to fully disable (no listeners, never idle).
 * - Tab-hidden time doesn't count as activity, but the timer is paused while hidden and
 *   restarted on return — so a backgrounded tab won't pop the screensaver the instant you
 *   switch back.
 * - `wake()` lets a caller dismiss imperatively (e.g. the overlay swallowing the first tap).
 */
export function useInactivity(delayMs: number, enabled: boolean): { idle: boolean; wake: () => void } {
  const [idle, setIdle] = useState(false);
  const idleRef = useRef(false);
  idleRef.current = idle;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIdle(false);
      return;
    }

    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const arm = () => {
      clear();
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        timerRef.current = setTimeout(() => setIdle(true), delayMs);
      }
    };
    const onActivity = () => {
      if (idleRef.current) setIdle(false);
      arm();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') clear();
      else arm();
    };

    const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll'];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    arm();

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      clear();
    };
  }, [delayMs, enabled]);

  return { idle, wake: () => setIdle(false) };
}
