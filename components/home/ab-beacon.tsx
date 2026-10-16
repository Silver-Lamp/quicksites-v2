'use client';

// components/home/ab-beacon.tsx — records the exposure for the variant the server rendered and,
// on a fresh draw, asks the route to set the sticky cookie. Renders nothing.
import * as React from 'react';
import { abEvent } from '@/lib/ab/client';
import type { AbVariant } from '@/lib/ab/homepage';

export default function AbBeacon({ variant, assigned }: { variant: AbVariant; assigned: boolean }) {
  React.useEffect(() => {
    try {
      (window as any).__qsAbVariant = variant;
    } catch {}
    abEvent('exposure', { variant, assign: assigned });
  }, [variant, assigned]);
  return null;
}
