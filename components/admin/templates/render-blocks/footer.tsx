// components/site/render-blocks/footer.tsx
'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useEffect, useState } from 'react';
import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import {
  Globe,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  Github,
  Phone,
  Mail,
  MessageCircle, // WhatsApp
  Send,          // Telegram
  Star,          // TikTok/Yelp fallback
  // If you're on lucide >=0.441, you can use X icon like:
  // SquareLetterX as XIcon,
} from 'lucide-react';

const LeafletMap = dynamic(
  () => import('@/components/ui/leaflet-footer-map').then((m) => m.LeafletFooterMap),
  { ssr: false }
);

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
    onChange(); // set initial
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

  // choose your X icon
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

export default function PublicFooter({
  block,
  content,
  template,
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

  // Auto-compact below 420px unless explicitly overridden by prop
  const isNarrow = useMediaQuery('(max-width: 420px)');
  const compactMode = compact || isNarrow;
  
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

  // NEW: social icon style from meta.socialIcons
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

  if (compactMode) {
    return (
      <div className={`${bgColor} ${textColor} rounded p-3`}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs">
            <p className="font-semibold leading-tight">{businessName}</p>
            <p className={subText}>{cityStatePostal}</p>
          </div>
          {socials.length > 0 && (
            <ul
              className={[
                'grid gap-2',
                socialStyle === 'labels'
                  ? 'grid-cols-2 sm:grid-cols-3'
                  : 'grid-flow-col auto-cols-max',
              ].join(' ')}
            >
              {socials.map((s) => {
                const isExternal = !/^mailto:|^tel:/i.test(s.href);
                const base =
                  socialStyle === 'icons'
                    ? 'inline-flex items-center justify-center h-8 w-8 rounded-full border border-white/20 hover:border-white/40'
                    : 'inline-flex items-center gap-2 px-2.5 py-1.5 rounded border border-white/20 hover:border-white/40';
                const cls = `${linkColor} ${base}`;
                return (
                  <li key={s.key} className="justify-self-end sm:justify-self-auto">
                    {isExternal ? (
                      <a
                        href={s.href}
                        className={cls}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.aria}
                        title={s.label}
                      >
                        {renderSocialContent(s)}
                      </a>
                    ) : (
                      <a href={s.href} className={cls} aria-label={s.aria} title={s.label}>
                        {renderSocialContent(s)}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <footer className={`${bgColor} ${textColor} px-6 py-10 text-sm mt-10`}>
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Quick Links */}
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

        {/* Company Info */}
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

        {/* Follow Us */}
        <div>
          <h4 className={`font-bold uppercase mb-3 ${headingColor}`}>Follow Us</h4>
          {socials.length ? (
            <ul className="space-y-2">
              {socials.map((s) => {
                const isExternal = !/^mailto:|^tel:/i.test(s.href);
                const baseCls = `${linkColor} inline-flex items-center gap-2 hover:underline`;
                return (
                  <li key={s.key}>
                    {isExternal ? (
                      <a
                        href={s.href}
                        className={baseCls}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.aria}
                        title={s.label}
                      >
                        {renderSocialContent(s)}
                      </a>
                    ) : (
                      <a href={s.href} className={baseCls} aria-label={s.aria} title={s.label}>
                        {renderSocialContent(s)}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={subText}>No social links yet.</p>
          )}
        </div>
      </div>

      <div className={`text-center mt-8 text-xs ${subText}`}>
        © {new Date().getFullYear()} {businessName}. Fast, Reliable, Local Service 24/7.
      </div>
    </footer>
  );
}
