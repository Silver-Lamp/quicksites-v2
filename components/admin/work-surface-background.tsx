'use client';

// Fixed decorative backdrop for the admin work surface. Sits at -z-10 behind all
// chrome (sidebar/header) and content panels — it shows through in the gaps and
// under translucent chrome, but opaque panels and the template-editor canvas paint
// over it, so the site-in-progress is never muddied. The chosen background is a
// per-user client preference (localStorage), picked in the profile. A special
// "rotate" selection auto-cycles through all backgrounds with a slow crossfade.

import * as React from 'react';
import {
  WORK_BACKGROUNDS,
  WORK_BG_CHANGED_EVENT,
  WORK_BG_ROTATE_ID,
  findWorkBackground,
  readWorkBackgroundId,
} from '@/lib/ui/workBackgrounds';

const ROTATE_INTERVAL_MS = 25_000; // dwell per image before crossfading to the next

export default function WorkSurfaceBackground() {
  const [id, setId] = React.useState<string>('');

  React.useEffect(() => {
    setId(readWorkBackgroundId());
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setId(typeof detail === 'string' ? detail : readWorkBackgroundId());
    };
    window.addEventListener(WORK_BG_CHANGED_EVENT, onChanged as EventListener);
    const onStorage = () => setId(readWorkBackgroundId());
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(WORK_BG_CHANGED_EVENT, onChanged as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const rotating = id === WORK_BG_ROTATE_ID;

  // Advance the active index on an interval while rotating.
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    if (!rotating || WORK_BACKGROUNDS.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % WORK_BACKGROUNDS.length), ROTATE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [rotating]);

  const single = findWorkBackground(id);
  if (!rotating && !single) return null; // No selection → let the app's bg-background show.

  const scrim = <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/60" />;

  if (rotating) {
    return (
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
        {WORK_BACKGROUNDS.map((b, i) => (
          <div
            key={b.id}
            className="absolute inset-0 bg-cover bg-center bg-fixed transition-opacity duration-[2000ms] ease-in-out"
            style={{ backgroundImage: `url(${b.src})`, opacity: i === idx ? b.opacity : 0 }}
          />
        ))}
        {scrim}
      </div>
    );
  }

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url(${single!.src})`, opacity: single!.opacity }}
      />
      {scrim}
    </div>
  );
}
