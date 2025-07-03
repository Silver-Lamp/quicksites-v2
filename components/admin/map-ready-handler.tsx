import { useMap } from 'react-leaflet';
import { useEffect } from 'react';

function MapReadyHandler({ mapRef }: { mapRef: React.RefObject<HTMLDivElement> }) {
  const map = useMap();

  useEffect(() => {
    const container = mapRef.current?.querySelector('.leaflet-container') as any;
    if (container) container._leaflet_map = map;
  }, [map, mapRef]);

  return null;
}
