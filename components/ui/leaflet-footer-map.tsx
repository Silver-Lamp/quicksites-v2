'use client';

import dynamic from 'next/dynamic';
import * as React from 'react';

export type LeafletFooterMapProps = {
  center: [number, number];     // validated by the caller (we also guard inside)
  zoom?: number;
  height?: number;
  markerTitle?: string;
  interactive?: boolean;
};

/** Typed dynamic import to avoid prop type errors in callers */
export const LeafletFooterMap = dynamic<LeafletFooterMapProps>(
  () =>
    import('./leaflet-map-inner').then(
      (m) => m.LeafletMapInner as unknown as React.ComponentType<LeafletFooterMapProps>
    ),
  { ssr: false, loading: () => <div className="h-[180px] w-full bg-black/10" /> }
);
