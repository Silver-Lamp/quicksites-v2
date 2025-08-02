'use client';

import dynamic from 'next/dynamic';
import type { Block } from '@/types/blocks';
import Link from 'next/link';
import SectionShell from '@/components/ui/section-shell';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';

const LeafletMap = dynamic(
  () => import('@/components/ui/leaflet-footer-map').then(mod => mod.LeafletFooterMap),
  { ssr: false }
);

const geocodeCache = new Map<string, [number, number]>();

function useGeocode(address: string | null | undefined) {
  const [coords, setCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!address) return;

    if (geocodeCache.has(address)) {
      setCoords(geocodeCache.get(address)!);
      return;
    }

    const fetchCoords = async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
          { headers: { 'User-Agent': 'QuickSites (admin@quicksites.ai)' } }
        );
        const data = await res.json();
        if (data?.length > 0) {
          const { lat, lon } = data[0];
          const parsed: [number, number] = [parseFloat(lat), parseFloat(lon)];
          geocodeCache.set(address, parsed);
          setCoords(parsed);
        }
      } catch (err) {
        console.error('Geocoding failed:', err);
      }
    };

    fetchCoords();
  }, [address]);

  return coords;
}

type Props = {
  block?: Block;
  content?: Block['content'];
  compact?: boolean;
  colorMode?: 'light' | 'dark';
};

export default function FooterRender({
  block,
  content,
  compact = false,
  colorMode = 'dark',
}: Props) {
  const final = content || block?.content;

  const fullAddress = final ? `${final.address || '123 Main St'}, ${final.cityState || ''}` : null;
  const coords = useGeocode(fullAddress);

  if (!final) {
    return (
      <div className="text-red-500 italic text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        ⚠️ Missing footer block content.
      </div>
    );
  }

  const {
    businessName = 'Business',
    address = '123 Main St',
    cityState = 'Your City, ST',
    phone = '(555) 555-5555',
    links = [],
  } = final;

  const bgColor = colorMode === 'light' ? 'bg-white' : 'bg-neutral-950';
  const textColor = colorMode === 'light' ? 'text-gray-900' : 'text-white';
  const subText = colorMode === 'light' ? 'text-gray-600' : 'text-gray-400';
  const linkColor = colorMode === 'light' ? 'text-blue-600 hover:text-blue-700' : 'text-yellow-400 hover:text-yellow-500';
  const headingColor = colorMode === 'light' ? 'text-black' : 'text-white';

  if (compact) {
    return (
      <SectionShell compact className={`${bgColor} ${textColor} text-xs rounded`} textAlign="left">
        <p className="font-semibold">{businessName}</p>
        <p className={subText}>{cityState}</p>
      </SectionShell>
    );
  }

  return (
    <footer className={`${bgColor} ${textColor} px-6 py-10 text-sm mt-10`}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-8">
        <div>
          <h4 className={`font-bold uppercase mb-3 ${headingColor}`}>Quick Links</h4>
          <ul className="space-y-1">
            {links.map((link: { href: string; label: string }, i: number) => (
              <li key={i}>
                <Link href={link.href} className={`${linkColor} hover:underline`}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className={`font-bold uppercase mb-3 ${headingColor}`}>Company Info</h4>
          <p className={`font-semibold ${textColor}`}>{businessName}</p>
          <p className={textColor}>
            {address}
            <br />
            {cityState}
          </p>
          <p className={`mt-1 ${textColor}`}>{phone}</p>

          {coords && (
            <LeafletMap coords={coords} businessName={businessName} fullAddress={fullAddress!} />
          )}
        </div>
      </div>
      <div className={`text-center mt-8 text-xs ${subText}`}>
        © {new Date().getFullYear()} {businessName}. Fast, Reliable, Local Service 24/7.
      </div>
    </footer>
  );
}
