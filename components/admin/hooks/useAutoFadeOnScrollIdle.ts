// components/admin/hooks/useAutoFadeOnScrollIdle.ts
import { useEffect, useState } from 'react';

type Opts = {
  delay?: number;          // ms of inactivity before fading
  initialVisibleMs?: number; // show for a bit on mount
};

export function useAutoFadeOnScrollIdle({ delay = 1000, initialVisibleMs = 1000 }: Opts = {}) {
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    let t: number | null = null;

    const arm = (ms = delay) => {
      if (t) clearTimeout(t);
      t = window.setTimeout(() => setFaded(true), ms);
    };

    const wake = () => {
      // any scroll-like activity brings it back
      if (t) clearTimeout(t);
      setFaded(false);
      arm(delay);
    };

    // show briefly on mount, then arm
    setFaded(false);
    arm(initialVisibleMs);

    // listen to a few inputs that indicate scrolling
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener('scroll', wake, opts);
    window.addEventListener('wheel', wake, opts);
    window.addEventListener('touchmove', wake, opts);
    window.addEventListener('keydown', (e) => {
      // keys that typically scroll
      if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key)) wake();
    }, true);

    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener('scroll', wake, opts as any);
      window.removeEventListener('wheel', wake, opts as any);
      window.removeEventListener('touchmove', wake, opts as any);
      // keydown handler is anonymous; page unmount clears it anyway
    };
  }, [delay, initialVisibleMs]);

  return faded;
}
