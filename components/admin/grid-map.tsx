// components/admin/grid-map.tsx
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

const _cache: { points?: CityPoint[]; lastFetched?: number } = {};

export default function GridMap() {
  const [industry, setIndustry] = useState('');
  const [points, setPoints] = useState<CityPoint[]>([]);
  const [zoom, setZoom] = useState(4);
  const [showHotspotsOnly, setShowHotspotsOnly] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const now = Date.now();
      if (_cache.points && _cache.lastFetched && now - _cache.lastFetched < 60_000) {
        setPoints(_cache.points);
        return;
      }
      const { data: campaignLinks } = await supabase
        .from('campaign_leads')
        .select('campaign_id, lead_id');

      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, city, state');
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
          leadsQty: 0,
          domains: 0,
          leads: [],
          domainNames: [],
          leadIds: [],
          industryCounts: {},
        };
        geo[key].leadsQty += 1;
        const isUnclaimed = !campaignLinks?.some((cl) => cl.lead_id === l.id);
        if (l.business_name) geo[key].leads.push({ id: l.id, name: l.business_name, isClaimed: !isUnclaimed, campaignId: '', industry: l.industry || '' });
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

          const campaignIds = new Set(
            campaignLinks
              ?.filter((cl) => entry.leadIds.includes(cl.lead_id))
              .map((cl) => cl.campaign_id)
          );

          const campaignNames = campaigns
            ?.filter((c) => campaignIds.has(c.id))
            .map((c) => c.name) ?? [];

          const unclaimed = entry.leadIds.filter(
            (id) => !campaignLinks?.some((cl) => cl.lead_id === id)
          ).length;
          const unclaimedByIndustry: Record<string, number> = {};

          for (const lead of entry.leads) {
            const ind = (lead.industry || '').trim().toLowerCase();
            if (!lead.isClaimed) {
              unclaimedByIndustry[ind] = (unclaimedByIndustry[ind] || 0) + 1;
            }
          }

          const has2PlusUnclaimedInSameIndustry = Object.values(unclaimedByIndustry).some(
            (count) => count >= 2
          );

          return {
            ...entry,
            lat,
            lon,
            industry: primaryIndustry,
            campaigns: campaignNames,
            unclaimedLeadCount: unclaimed,
            has2PlusUnclaimedInSameIndustry,
          };
        })
      );

      setPoints(enriched);
      _cache.points = enriched;
      _cache.lastFetched = now;
    };

    load();
  }, []);

  const getColor = (p: CityPoint) => {
    if (p.has2PlusUnclaimedInSameIndustry) return 'red';
    if (p.unclaimedLeadCount && p.unclaimedLeadCount >= 1) return 'yellow';
    if (p.leadsQty >= 2 && p.domains > 0) return 'green';
    if (p.leadsQty >= 2) return 'orange';
    if (p.domains > 0) return 'blue';
    if (p.leadsQty > 0) return 'yellow';
    return 'gray';
  };

  const getUnclaimedLeadCount = (p: CityPoint) => {
    return p.leads.filter((l) => !l.isClaimed).length;
  };

  const filteredPoints = points.filter((p) => {
    if (!industry || industry === '') return true;
    if (!p.industry) return false;
    return p.industry.trim().toLowerCase() === industry.trim().toLowerCase();
  });

  const visiblePoints = showHotspotsOnly
    ? filteredPoints.filter((p) => p.has2PlusUnclaimedInSameIndustry)
    : filteredPoints;

  return (
    <div className="p-6 text-white">
      <div className="flex items-center justify-between mb-6">

        <h1 className="text-3xl font-bold">🌍 The Grid</h1>
        <button
          className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded border border-zinc-600"
          onClick={() => {
            _cache.points = undefined;
            _cache.lastFetched = 0;
            location.reload();
          }}
        >
          🔄 Refresh
        </button>
        <div className="md:w-2/5 w-full">
          <GridSidebar
            industry={industry}
            setIndustry={setIndustry}
            filteredPoints={filteredPoints}
            showHotspotsOnly={showHotspotsOnly}
            setShowHotspotsOnly={setShowHotspotsOnly}
            // visiblePoints={visiblePoints}
          />
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full h-[600px] border border-gray-700 rounded overflow-hidden">
          <SafeLeafletMap
            points={visiblePoints}
            zoom={zoom}
            setZoom={setZoom}
            router={router}
            getColor={getColor}
          />
        </div>
      </div>
      <div className="text-xs text-zinc-400 mt-2">
          <div className="flex gap-4 items-center text-sm mt-2">
            <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-yellow-500 rounded-full"></span> 1 Lead</div>
            <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-orange-500 rounded-full"></span> 2+ Leads</div>
            <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-blue-500 rounded-full"></span> 1+ Domain</div>
            <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span> Lead + Domain</div>
            <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red-600 rounded-full"></span> 2+ Unclaimed in 1 Industry</div>
          </div>
        </div>
    </div>
  );
}
