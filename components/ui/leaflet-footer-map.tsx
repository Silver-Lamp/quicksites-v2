'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

type Props = {
  coords: [number, number];
  businessName: string;
  fullAddress: string;
};

const LeafletMap = dynamic(() => import('./leaflet-map-inner'), { ssr: false });

export function LeafletFooterMap({ coords, businessName, fullAddress }: Props) {
  return (
    <div className="mt-4 h-52 rounded overflow-hidden shadow border border-white/10 w-full md:w-80 md:mx-auto">
      <LeafletMap coords={coords} businessName={businessName} fullAddress={fullAddress} />
    </div>
  );
}
