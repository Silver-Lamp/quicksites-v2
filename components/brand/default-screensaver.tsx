'use client';

// A preset screensaver for OUR OWN surfaces (marketing home, etc.) — default ON, opt-out per
// surface. Distinct from the per-site service (components/sites/site-screensaver.tsx), which
// reads a published site's config. Resolves client-side so the fireplace day/night pick matches
// the visitor's local time.

import * as React from 'react';
import Screensaver from '@/components/brand/screensaver';
import { resolveScreensaver, type ScreensaverPreset } from '@/lib/screensaver/config';

export default function DefaultScreensaver({
  preset = 'fireplace',
  idleSeconds = 150,
  optOutKey = 'qs_screensaver_off:home',
  caption = 'Move or tap to resume',
}: {
  preset?: ScreensaverPreset;
  idleSeconds?: number;
  optOutKey?: string;
  caption?: string;
}) {
  const resolved = React.useMemo(
    () => resolveScreensaver({ enabled: true, preset, idleSeconds, caption }),
    [preset, idleSeconds, caption],
  );
  return <Screensaver config={resolved} optOutKey={optOutKey} />;
}
