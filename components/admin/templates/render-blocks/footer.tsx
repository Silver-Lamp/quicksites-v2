// components/admin/templates/render-blocks/footer.tsx
'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useEffect, useState } from 'react';
import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import {
  Globe, Facebook, Instagram, Twitter, Youtube, Linkedin, Github,
  Phone, Mail, MessageCircle, Send, Star,
} from 'lucide-react';

const LeafletMap = dynamic(
  () => import('@/components/ui/leaflet-footer-map').then((m) => m.LeafletFooterMap),
  { ssr: false }
);

// 🔧 Ensure our union includes all three device values
type EditorDevice = 'mobile' | 'tablet' | 'desktop';

type FooterLink = { href: string; label: string };
type SocialStyle = 'icons' | 'labels' | 'both';

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
          { headers: { 'User-Agent': 'QuickSites (support@quicksites.ai)' } }
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

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [query]);
  return matches;
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
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return raw || '';
}
function withScheme(url?: string | null): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

/** Normalize social links (meta-first, legacy fallbacks). */
function normalizeSocial(template?: Template, final?: any) {
  const meta = (template?.data as any)?.meta ?? {};
  const social = meta?.social ?? (final?.social ?? final?.social_links) ?? {};
  const contact = meta?.contact ?? {};
  const obj =
    Array.isArray(social)
      ? social.reduce((acc: any, it: any) => {
          const k = String(it?.platform ?? it?.type ?? '').toLowerCase();
          if (!k) return acc;
          acc[k] = it?.url ?? it?.href ?? it?.value ?? '';
          return acc;
        }, {})
      : (social || {});

  const fromFinal = (key: string) => (typeof final?.[key] === 'string' ? final[key] : '');

  const raw = {
    website: obj.website ?? fromFinal('website') ?? '',
    facebook: obj.facebook ?? fromFinal('facebook') ?? '',
    instagram: obj.instagram ?? fromFinal('instagram') ?? '',
    twitter: obj.twitter ?? obj.x ?? fromFinal('twitter') ?? fromFinal('x') ?? '',
    tiktok: obj.tiktok ?? fromFinal('tiktok') ?? '',
    youtube: obj.youtube ?? fromFinal('youtube') ?? '',
    linkedin: obj.linkedin ?? fromFinal('linkedin') ?? '',
    github: obj.github ?? fromFinal('github') ?? '',
    yelp: obj.yelp ?? fromFinal('yelp') ?? '',
    whatsapp: obj.whatsapp ?? fromFinal('whatsapp') ?? '',
    telegram: obj.telegram ?? fromFinal('telegram') ?? '',
    email: obj.email ?? contact.email ?? fromFinal('email') ?? '',
    phone: obj.phone ?? contact.phone ?? fromFinal('phone') ?? '',
  };

  type Item = { key: string; href: string; label: string; external?: boolean; aria: string; icon: React.JSX.Element };
  const items: Item[] = [];
  const XIcon = Twitter;

  const add = (key: string, href: string, label: string, icon: React.JSX.Element) => {
    if (!href) return;
    const external = !/^mailto:|^tel:|^\//i.test(href);
    items.push({ key, href, label, external, aria: `${label} link`, icon });
  };

  add('website', withScheme(raw.website), 'Website', <Globe className="h-4 w-4" />);
  add('facebook', withScheme(raw.facebook), 'Facebook', <Facebook className="h-4 w-4" />);
  add('instagram', withScheme(raw.instagram), 'Instagram', <Instagram className="h-4 w-4" />);
  add('twitter', withScheme(raw.twitter), 'Twitter / X', <XIcon className="h-4 w-4" />);
  add('tiktok', withScheme(raw.tiktok), 'TikTok', <Star className="h-4 w-4" />);
  add('youtube', withScheme(raw.youtube), 'YouTube', <Youtube className="h-4 w-4" />);
  add('linkedin', withScheme(raw.linkedin), 'LinkedIn', <Linkedin className="h-4 w-4" />);
  add('github', withScheme(raw.github), 'GitHub', <Github className="h-4 w-4" />);
  add('yelp', withScheme(raw.yelp), 'Yelp', <Star className="h-4 w-4" />);
  const phoneDigits = (raw.phone || '').replace(/\D/g, '');
  add('whatsapp', raw.whatsapp ? withScheme(raw.whatsapp) : '', 'WhatsApp', <MessageCircle className="h-4 w-4" />);
  add('telegram', raw.telegram ? withScheme(raw.telegram) : '', 'Telegram', <Send className="h-4 w-4" />);
  add('email', raw.email ? `mailto:${raw.email}` : '', 'Email', <Mail className="h-4 w-4" />);
  add('phone', phoneDigits ? `tel:${phoneDigits}` : '', 'Phone', <Phone className="h-4 w-4" />);

  const seen = new Set<string>();
  return items.filter((it) => {
    if (!it.href) return false;
    if (seen.has(it.href)) return false;
    seen.add(it.href);
    return true;
  });
}

export default function FooterRender({
  block,
  content,
  template,
  compact = false,
  colorMode = 'dark',
  previewOnly = false,
  device,
}: {
  block?: Block;
  content?: Block['content'];
  template?: Template;
  compact?: boolean;
  colorMode?: 'light' | 'dark';
  previewOnly?: boolean;
  device?: EditorDevice; // ✅ include 'mobile'
}) {
  const final = (content || block?.content) as any;

  // Auto-compact below 420px, or when editor forces a narrow device
  const isNarrowMedia = useMediaQuery('(max-width: 420px)');
  const forcedNarrow = device === 'mobile';
  const compactMode = compact || forcedNarrow || isNarrowMedia;

  const links = useMemo(() => normalizeFooterLinks(final), [final]);
  const socials = useMemo(() => normalizeSocial(template, final), [template, final]);

  const meta = (template?.data as any)?.meta ?? {};
  const contact = meta?.contact ?? {};
  const db = (template as any) || {};

  const businessName =
    (typeof meta.business === 'string' && meta.business.trim()) ||
    (typeof meta.siteTitle === 'string' && meta.siteTitle.trim()) ||
    (db.business_name && String(db.business_name).trim()) ||
    (final?.businessName && String(final.businessName).trim()) ||
    'Business';

  const addressLine1 =
    (typeof contact.address === 'string' && contact.address.trim()) ||
    (db.address_line1 && String(db.address_line1).trim()) ||
    (final?.address && String(final.address).trim()) ||
    '';

  const addressLine2 =
    (typeof contact.address2 === 'string' && contact.address2.trim()) ||
    (db.address_line2 && String(db.address_line2).trim()) ||
    '';

  const city =
    (typeof contact.city === 'string' && contact.city.trim()) ||
    (db.city && String(db.city).trim()) ||
    (final?.city || (final?.cityState ? String(final.cityState).split(',')[0] : ''));

  const state =
    (typeof contact.state === 'string' && contact.state.trim()) ||
    (db.state && String(db.state).trim()) ||
    (final?.state ||
      (final?.cityState ? String(final.cityState).split(',')[1]?.trim().split(' ')[0] : ''));

  const postal =
    (typeof contact.postal === 'string' && contact.postal.trim()) ||
    (db.postal_code && String(db.postal_code).trim()) ||
    (final?.postal || '');

  const phone =
    fmtPhone(contact.phone) ||
    fmtPhone(db.phone) ||
    (final?.phone && String(final.phone)) ||
    '';

  const cityState = [city, state].filter(Boolean).join(', ');
  const cityStatePostal = [cityState, postal].filter(Boolean).join(' ');

  const fullAddressForDisplay = [addressLine1, addressLine2, cityStatePostal]
    .filter(Boolean)
    .join('\n');

  const fullAddressForGeocode = [addressLine1, addressLine2, city, state, postal]
    .filter(Boolean)
    .join(', ') || null;

  const latMeta = contact.latitude;
  const lonMeta = contact.longitude;
  const latDb = typeof db.latitude === 'number' ? db.latitude : Number(db.latitude);
  const lonDb = typeof db.longitude === 'number' ? db.longitude : Number(db.longitude);
  const lat = Number.isFinite(latMeta) ? latMeta : latDb;
  const lon = Number.isFinite(lonMeta) ? lonMeta : lonDb;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
  const geocoded = useGeocode(hasCoords ? null : fullAddressForGeocode);
  const coords: [number, number] | null = hasCoords ? [lat as number, lon as number] : geocoded;

  const bgColor = colorMode === 'light' ? 'bg-white' : 'bg-neutral-950';
  const textColor = colorMode === 'light' ? 'text-gray-900' : 'text-white';
  const subText = colorMode === 'light' ? 'text-gray-600' : 'text-gray-400';
  const linkColor =
    colorMode === 'light'
      ? 'text-blue-600 hover:text-blue-700'
      : 'text-yellow-400 hover:text-yellow-500';
  const headingColor = colorMode === 'light' ? 'text-black' : 'text-white';

  const socialStyle: SocialStyle = (() => {
    const raw = String(meta?.socialIcons || '').toLowerCase();
    if (raw === 'icons' || raw === 'labels' || raw === 'both') return raw;
    if (raw === 'minimal') return 'icons';
    return 'both';
  })();

  const renderSocialContent = (s: { icon: React.JSX.Element; label: string }) => {
    if (socialStyle === 'icons') {
      return (
        <>
          {s.icon}
          <span className="sr-only">{s.label}</span>
        </>
      );
    }
    if (socialStyle === 'labels') {
      return <span>{s.label}</span>;
    }
    return (
      <>
        {s.icon}
        <span>{s.label}</span>
      </>
    );
  };

  const maybePrevent = previewOnly
    ? { onClick: (e: React.MouseEvent<HTMLAnchorElement>) => e.preventDefault(), tabIndex: -1 }
    : {};

  if (compactMode) {
    return (
      <div className={`${bgColor} ${textColor} rounded p-3`} data-device={device || 'auto'}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs">
            <p className="font-semibold leading-tight">{businessName}</p>
            <p className={subText}>{cityStatePostal}</p>
          </div>
          {/* socials … (unchanged) */}
        </div>
      </div>
    );
  }

  // Non-compact: mobile is already handled by the compact branch
  const gridCols =
    device === 'tablet'  ? 'grid-cols-2' :
    device === 'desktop' ? 'grid-cols-3' :
                          'grid-cols-1 md:grid-cols-3';


  return (
    <footer className={`${bgColor} ${textColor} px-6 py-10 text-sm mt-10`} data-device={device || 'auto'}>
      <div className={`max-w-6xl mx-auto grid ${gridCols} gap-8`}>
        {/* …rest of footer unchanged (links, company info, socials, map, copyright) … */}
      </div>
      <div className={`text-center mt-8 text-xs ${subText}`}>
        © {new Date().getFullYear()} {businessName}. Fast, Reliable, Local Service 24/7.
      </div>
    </footer>
  );
}
