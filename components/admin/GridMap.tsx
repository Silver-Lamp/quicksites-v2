import L from 'leaflet';
import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { resolveGeo } from '@/lib/resolveGeo';

export default function GridMap() {
  const [industry, setIndustry] = useState('');
  const [points, setPoints] = useState<any[]>([]);
  const [zoom, setZoom] = useState(4);
  const router = useRouter();
  const mapRef = useRef<L.Map>(null);

  useEffect(() => {
    const load = async () => {
      const { data: leads } = await supabase.from('leads').select('id, business_name, address_city, address_state, industry');
      const { data: domains } = await supabase.from('domains').select('city, state, domain');

      const geo: Record<string, {
        city: string;
        state: string;
        leads: number;
        domains: number;
        leadNames: string[];
        domainNames: string[];
        leadIds: string[];
        industryCounts: Record<string, number>;
      }> = {};

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
          industryCounts: {}
        };
        geo[key].leads += 1;
        if (l.business_name) geo[key].leadNames.push(l.business_name);
        geo[key].leadIds.push(l.id);
        const indKey = (l.industry || '').trim().toLowerCase();
        geo[key].industryCounts[indKey] = (geo[key].industryCounts[indKey] || 0) + 1;
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
          industryCounts: {}
        };
        geo[key].domains += 1;
        if (d.domain) geo[key].domainNames.push(d.domain);
      }

      const enriched = await Promise.all(Object.values(geo).map(async (entry) => {
        const { lat, lon } = await resolveGeo(entry.city, entry.state);

        const primaryIndustry = Object.entries(entry.industryCounts || {}).reduce(
          (acc, [ind, count]) => (count > (acc[1] || 0) ? [ind, count] : acc),
          ['', 0]
        )[0];

        return { ...entry, lat, lon, industry: primaryIndustry };
      }));

      setPoints(enriched);
    };

    load();
  }, []);

  const getColor = (p: any) => {
    if (p.leads >= 2 && p.domains > 0) return 'green';
    if (p.leads >= 2) return 'orange';
    if (p.domains > 0) return 'blue';
    if (p.leads > 0) return 'yellow';
    return 'gray';
  };

  const filterByIndustry = (p: any) => {
    if (!industry || industry === '') return true;
    if (!p.industry) return false;
    return p.industry.trim().toLowerCase() === industry.trim().toLowerCase();
  };

  const filteredPoints = points.filter(filterByIndustry);

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-6">🌍 The Grid</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/2 space-y-4">
          <div className="space-y-2">
            <label className="text-lg text-gray-300">Filter by Industry:</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white px-3 py-2 text-lg rounded w-full"
            >
              <option value="">All</option>
              <option value="towing">Towing</option>
              <option value="concrete">Concrete</option>
            </select>
          </div>

          <div className="p-4 border border-green-700 rounded bg-black/30">
            <h2 className="text-2xl font-bold text-green-400 mb-2">💼 Revenue Opportunity</h2>
            <p className="text-xl text-green-200">
              {(() => {
                const total = filteredPoints.reduce((sum, p) => {
                  if (p.leads >= 2 && p.domains > 0) return sum + 49 * 1.0;
                  if (p.leads >= 2) return sum + 49 * 0.75;
                  if (p.leads === 2) return sum + 49 * 0.5;
                  if (p.leads === 1) return sum + 49 * 0.25;
                  return sum;
                }, 0);
                return `$${total.toFixed(2)} / month`;
              })()}
            </p>
          </div>

          <div className="text-lg text-gray-300">
            {(() => {
              const yellow = filteredPoints.filter(p => p.leads === 1 && p.domains === 0).length;
              const orange = filteredPoints.filter(p => p.leads >= 2 && p.domains === 0).length;
              const blue = filteredPoints.filter(p => p.leads === 0 && p.domains > 0).length;
              const green = filteredPoints.filter(p => p.leads >= 2 && p.domains > 0).length;
              return `Visible Markers — 🟡 ${yellow}  🟠 ${orange}  🔵 ${blue}  🟢 ${green}`;
            })()}
          </div>

          <div className="space-x-4 text-base">
            <span className="inline-block w-4 h-4 bg-yellow-400 rounded-full"></span> 1 Lead
            <span className="inline-block w-4 h-4 bg-orange-500 rounded-full"></span> 2+ Leads
            <span className="inline-block w-4 h-4 bg-blue-500 rounded-full"></span> 1+ Domain
            <span className="inline-block w-4 h-4 bg-green-500 rounded-full"></span> Lead + Domain
          </div>
        </div>

        <div className="lg:w-1/2 h-[600px] border border-gray-700 rounded overflow-hidden">
          <MapContainer
            center={[39.5, -98.35]}
            zoom={4}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
            whenReady={() => {
              const map = mapRef.current;
              if (map) {
                map.on('zoomend', () => setZoom(map.getZoom()));
              }
            }}
            ref={mapRef}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
            {filteredPoints.map((p, i) => {
              if (zoom < 4 && (p.leads + p.domains) < 3) return null;

              return (
                <CircleMarker
                  key={i}
                  center={[p.lat, p.lon]}
                  radius={6 + (p.leads + p.domains) * 0.5}
                  pathOptions={{ color: getColor(p), fillColor: getColor(p), fillOpacity: 0.7 }}
                >
                  <Popup className="w-64 p-4 bg-gray-800 text-white rounded-lg shadow-lg">
                    <div className="space-y-2">
                      <div className="text-lg font-bold">{p.city}, {p.state}</div>
                      <div className="text-sm">Leads: {p.leads}</div>
                      {p.leadNames.length > 0 && (
                        <div className="text-xs text-gray-300">{p.leadNames.join(', ')}</div>
                      )}
                      <div className="text-sm mt-1">Domains: {p.domains}</div>
                      {p.domainNames.length > 0 && (
                        <div className="text-xs text-gray-300">{p.domainNames.join(', ')}</div>
                      )}
                      {p.leads >= 2 && (
                        <button
                          onClick={() => {
                            const query = new URLSearchParams({
                              city: p.city,
                              state: p.state,
                              leadIds: p.leadIds.join(',')
                            });
                            router.push(`/start-campaign?${query}`);
                          }}
                          className="mt-3 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 w-full"
                        >
                          🚀 Start Campaign
                        </button>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
