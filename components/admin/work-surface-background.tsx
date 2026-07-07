'use client';

// Fixed decorative backdrop for the admin work surface. Sits at -z-10 behind all
// chrome (sidebar/header) and content panels — it shows through in the gaps and
// under translucent chrome, but opaque panels and the template-editor canvas paint
// over it, so the site-in-progress is never muddied. The chosen background is a
// per-user client preference (localStorage), picked in the profile.

import * as React from 'react';
import {
  WORK_BG_CHANGED_EVENT,
  findWorkBackground,
  readWorkBackgroundId,
} from '@/lib/ui/workBackgrounds';

export default function WorkSurfaceBackground() {
  const [id, setId] = React.useState<string>('');

  React.useEffect(() => {
    setId(readWorkBackgroundId());
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setId(typeof detail === 'string' ? detail : readWorkBackgroundId());
    };
    window.addEventListener(WORK_BG_CHANGED_EVENT, onChanged as EventListener);
    // Also react to changes from other tabs.
    const onStorage = () => setId(readWorkBackgroundId());
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(WORK_BG_CHANGED_EVENT, onChanged as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const bg = findWorkBackground(id);

  // No selection → let the app's own `bg-background` show (render nothing).
  if (!bg) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url(${bg.src})`, opacity: bg.opacity }}
      />
      {/* Vignette scrim keeps content readable at the edges where chrome sits. */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/60" />
    </div>
  );
}
