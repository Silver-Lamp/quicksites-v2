// components/site/render-blocks/footer.tsx
'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useEffect, useState } from 'react';
import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';

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

function fmtPhone(raw?: string | null): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length !== 10) return raw || '';
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function PublicFooter({
  block,
  content,
  template, // ✅ expect Template so we can read DB values
  compact = false,
  colorMode = 'dark',
}: {
  block?: Block;
  content?: Block['content'];
  template?: Template;
  compact?: boolean;
  colorMode?: 'light' | 'dark';
}) {
  const final = (content || block?.content) as any;

  // Links from block content
  const links = useMemo(() => normalizeFooterLinks(final), [final]);

  // ---------- Prefer DB fields, fall back to legacy block content ----------
  const db = (template as any) || {};
  const businessName =
    (db.business_name && String(db.business_name).trim()) ||
    (final?.businessName && String(final.businessName).trim()) ||
    'Business';

  const addressLine1 =
    (db.address_line1 && String(db.address_line1).trim()) ||
    (final?.address && String(final.address).trim()) ||
    '';

  const addressLine2 = (db.address_line2 && String(db.address_line2).trim()) || '';

  const city =
    (db.city && String(db.city).trim()) ||
    (final?.city || (final?.cityState ? String(final.cityState).split(',')[0] : ''));

  const state =
    (db.state && String(db.state).trim()) ||
    (final?.state ||
      (final?.cityState ? String(final.cityState).split(',')[1]?.trim().split(' ')[0] : ''));

  const postal =
    (db.postal_code && String(db.postal_code).trim()) ||
    (final?.postal || '');

  const phone =
    fmtPhone(db.phone) || (final?.phone && String(final.phone)) || '';

  const cityState = [city, state].filter(Boolean).join(', ');
  const cityStatePostal = [cityState, postal].filter(Boolean).join(' ');

  const fullAddressForDisplay = [addressLine1, addressLine2, cityStatePostal]
    .filter(Boolean)
    .join('\n');

  const fullAddressForGeocode = [addressLine1, addressLine2, city, state, postal]
    .filter(Boolean)
    .join(', ') || null;

  // Prefer DB lat/lon; fall back to geocoding if missing
  const lat = typeof db.latitude === 'number' ? db.latitude : Number(db.latitude);
  const lon = typeof db.longitude === 'number' ? db.longitude : Number(db.longitude);
  const hasDbCoords = Number.isFinite(lat) && Number.isFinite(lon);
  const geocoded = useGeocode(hasDbCoords ? null : fullAddressForGeocode);
  const coords: [number, number] | null = hasDbCoords ? [lat, lon] : geocoded;

  // ---------- theming ----------
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
        <p className={subText}>{cityStatePostal}</p>
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
          <p className={textColor} style={{ whiteSpace: 'pre-line' }}>
            {fullAddressForDisplay || '—'}
          </p>
          {phone && <p className={`mt-1 ${textColor}`}>{phone}</p>}
          {coords && (
            <LeafletMap
              coords={coords}
              businessName={businessName}
              fullAddress={fullAddressForGeocode || ''}
            />
          )}
        </div>
      </div>
      <div className={`text-center mt-8 text-xs ${subText}`}>
        © {new Date().getFullYear()} {businessName}. Fast, Reliable, Local Service 24/7.
      </div>
    </footer>
  );
}
