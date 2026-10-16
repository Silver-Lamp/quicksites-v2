'use client';

// components/home/ab-beacon.tsx — records the exposure for the variant the server rendered and,
// on a fresh draw, asks the route to set the sticky cookie. Renders nothing.
import * as React from 'react';
import { abEvent } from '@/lib/ab/client';
import { AB_EXPERIMENT, type AbVariant } from '@/lib/ab/homepage';

export default function AbBeacon({ variant, assigned, experiment = AB_EXPERIMENT }: { variant: AbVariant; assigned: boolean; experiment?: string }) {
  React.useEffect(() => {
    const active = { experiment, variant };
    try {
      (window as any).__qsAb = active;
    } catch {}
    abEvent('exposure', { active, assign: assigned });
  }, [variant, assigned, experiment]);
  return null;
}
