'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';

type Props = {
  coords: [number, number];
  businessName: string;
  fullAddress: string;
};

export default function LeafletMapInner({ coords, businessName, fullAddress }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || leafletInstance.current) return;

    const icon = L.icon({
      iconUrl: iconUrl.src,
      shadowUrl: iconShadowUrl.src,
      iconAnchor: [12, 41],
    });

    const map = L.map(mapRef.current).setView(coords, 13);
    leafletInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.marker(coords, { icon })
      .addTo(map)
      .bindPopup(`${businessName}<br>${fullAddress}`)
      .openPopup();

    return () => {
      map.remove();
      leafletInstance.current = null;
    };
  }, [coords, businessName, fullAddress]);

  return <div ref={mapRef} className="w-full h-full z-0" />;
}
