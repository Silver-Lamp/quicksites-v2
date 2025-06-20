'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function CheckinMapPage() {
  const [points, setPoints] = useState([]);

  useEffect(() => {
    fetch('/api/checkin-map')
      .then((res) => json())
      .then(setPoints);
  }, []);

  return (
    <div className="w-full h-screen">
      <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p: any) => (
          <Marker key={p.block_id} position={[p.lat, p.lon]}>
            <Popup>
              <div className="text-sm">
                <strong>{p.slug}</strong>
                <br />
                {p.total} check-ins
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
