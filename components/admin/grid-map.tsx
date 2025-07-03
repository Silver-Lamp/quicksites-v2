'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import { supabase } from '@/admin/lib/supabaseClient';
import GridSidebar from './grid-sidebar';
import { resolveGeo } from '@/lib/resolveGeo';
import type { CityPoint } from '@/types/grid';

// Dynamically load the Leaflet map so it's only rendered on the client
const SafeLeafletMap = dynamic(() => import('./safe-leaflet-map'), {
  ssr: false,
});

export default function GridMap() {
  const [industry, setIndustry] = useState('');
  const [points, setPoints] = useState<CityPoint[]>([]);
  const [zoom, setZoom] = useState(4);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, business_name, address_city, address_state, industry');

      const { data: domains } = await supabase
        .from('domains')
        .select('city, state, domain');

      const geo: Record<string, CityPoint> = {};

      for (const l of leads || []) {
        const key = `${l.address_city}, ${l.address_state}`;
        geo[key] = geo[key] || {
          city: l.address_city,
          state: l.address_state,
          leads: 0,
          domains: 0,
          leadNames: [],
          domainNames: [],
          leadIds: [],
          industryCounts: {},
        };
        geo[key].leads += 1;
        if (l.business_name) geo[key].leadNames.push(l.business_name);
        geo[key].leadIds.push(l.id);
        const indKey = (l.industry || '').trim().toLowerCase();
        geo[key].industryCounts![indKey] = (geo[key].industryCounts![indKey] || 0) + 1;
      }

      for (const d of domains || []) {
        const key = `${d.city}, ${d.state}`;
        geo[key] = geo[key] || {
          city: d.city,
          state: d.state,
          leads: 0,
          domains: 0,
          leadNames: [],
          domainNames: [],
          leadIds: [],
          industryCounts: {},
        };
        geo[key].domains += 1;
        if (d.domain) geo[key].domainNames.push(d.domain);
      }

      const enriched = await Promise.all(
        Object.values(geo).map(async (entry) => {
          const { lat, lon } = await resolveGeo(entry.city, entry.state);
          const primaryIndustry = Object.entries(entry.industryCounts || {}).reduce(
            (acc: [string, number], [ind, count]) =>
              typeof count === 'number' && count > acc[1] ? [ind, count] : acc,
            ['', 0]
          )[0];
          return { ...entry, lat, lon, industry: primaryIndustry };
        })
      );

      setPoints(enriched);
    };

    load();
  }, []);

  const getColor = (p: CityPoint) => {
    if (p.leads >= 2 && p.domains > 0) return 'green';
    if (p.leads >= 2) return 'orange';
    if (p.domains > 0) return 'blue';
    if (p.leads > 0) return 'yellow';
    return 'gray';
  };

  const filteredPoints = points.filter((p) => {
    if (!industry || industry === '') return true;
    if (!p.industry) return false;
    return p.industry.trim().toLowerCase() === industry.trim().toLowerCase();
  });

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-6">🌍 The Grid</h1>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-2/5 w-full">
          <GridSidebar
            industry={industry}
            setIndustry={setIndustry}
            filteredPoints={filteredPoints}
          />
        </div>
        <div className="md:w-3/5 w-full h-[600px] border border-gray-700 rounded overflow-hidden">
          <SafeLeafletMap
            points={filteredPoints}
            zoom={zoom}
            setZoom={setZoom}
            router={router}
            getColor={getColor}
          />
        </div>
      </div>
    </div>
  );
}
