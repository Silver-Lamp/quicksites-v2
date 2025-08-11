// components/site/render-blocks/footer.tsx (or your public renderer path)
'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useEffect, useState } from 'react';
import type { Block } from '@/types/blocks';

const LeafletMap = dynamic(
  () => import('@/components/ui/leaflet-footer-map').then((m) => m.LeafletFooterMap),
  { ssr: false }
);

type FooterLink = { href: string; label: string };

const REL = /^(https?:\/\/|mailto:|tel:|#)/i;
const geocodeCache = new Map<string, [number, number]>();

function useGeocode(address: string | null | undefined) {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (!address) return;
    if (geocodeCache.has(address)) {
      setCoords(geocodeCache.get(address)!);
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
          { headers: { 'User-Agent': 'QuickSites (admin@quicksites.ai)' } }
        );
        const data = await res.json();
        if (data?.length) {
          const { lat, lon } = data[0];
          const parsed: [number, number] = [parseFloat(lat), parseFloat(lon)];
          geocodeCache.set(address, parsed);
          setCoords(parsed);
        }
      } catch (e) {
        console.error('Geocoding failed:', e);
      }
    })();
  }, [address]);
  return coords;
}

function normalizeFooterLinks(final: any): FooterLink[] {
  const arr =
    (Array.isArray(final?.links) && final.links.length > 0 && final.links) ||
    (Array.isArray(final?.nav_items) && final.nav_items) ||
    (Array.isArray(final?.navItems) && final.navItems) ||
    [];

  const seen = new Set<string>();
  const out: FooterLink[] = [];
  for (const l of arr) {
    const href = String(l?.href ?? '').trim();
    const label = String(l?.label ?? '').trim();
    if (!href || !label) continue;
    const key = `${href}::${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ href, label });
  }
  return out;
}
const isInternal = (href: string) => href.startsWith('/');

export default function PublicFooter({
  block,
  content,
  compact = false,
  colorMode = 'dark',
}: {
  block?: Block;
  content?: Block['content'];
  compact?: boolean;
  colorMode?: 'light' | 'dark';
}) {
  const final = (content || block?.content) as any;

  // 🔧 normalize for published view as well
  const links = useMemo(() => normalizeFooterLinks(final), [final]);

  const businessName = final?.businessName ?? final?.business_name ?? 'Business';
  const address = final?.address ?? final?.street_address ?? '123 Main St';
  const cityState = final?.cityState ?? final?.city_state ?? 'Your City, ST';
  const phone = final?.phone ?? final?.phone_number ?? '(555) 555-5555';

  const fullAddress =
    `${address || ''}${address ? ', ' : ''}${cityState || ''}`.trim() || null;
  const coords = useGeocode(fullAddress);

  const bgColor = colorMode === 'light' ? 'bg-white' : 'bg-neutral-950';
  const textColor = colorMode === 'light' ? 'text-gray-900' : 'text-white';
  const subText = colorMode === 'light' ? 'text-gray-600' : 'text-gray-400';
  const linkColor =
    colorMode === 'light'
      ? 'text-blue-600 hover:text-blue-700'
      : 'text-yellow-400 hover:text-yellow-500';
  const headingColor = colorMode === 'light' ? 'text-black' : 'text-white';

  if (compact) {
    return (
      <div className={`${bgColor} ${textColor} text-xs rounded p-3`}>
        <p className="font-semibold">{businessName}</p>
        <p className={subText}>{cityState}</p>
      </div>
    );
  }

  return (
    <footer className={`${bgColor} ${textColor} px-6 py-10 text-sm mt-10`}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-8">
        <div>
          <h4 className={`font-bold uppercase mb-3 ${headingColor}`}>Quick Links</h4>
          {links.length ? (
            <ul className="space-y-1">
              {links.map((link, i) => {
                const key = `${link.href}-${i}`;
                if (!isInternal(link.href) && REL.test(link.href)) {
                  const external = /^https?:\/\//i.test(link.href);
                  return (
                    <li key={key}>
                      <a
                        href={link.href}
                        className={`${linkColor} hover:underline`}
                        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      >
                        {link.label}
                      </a>
                    </li>
                  );
                }
                return (
                  <li key={key}>
                    <Link href={link.href} className={`${linkColor} hover:underline`}>
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={subText}>No links yet.</p>
          )}
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
