// components/admin/templates/render-blocks/footer.tsx
'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import {
  Globe, Facebook, Instagram, Twitter, Youtube, Linkedin, Github,
  Phone, Mail, MessageCircle, Send, Star,
} from 'lucide-react';

type EditorDevice = 'mobile' | 'tablet' | 'desktop';

type FooterLink = { href: string; label: string };
type SocialStyle = 'icons' | 'labels' | 'both';

type LeafletFooterMapProps = {
  center: [number, number];
  zoom?: number;
  height?: number;
  markerTitle?: string;
  interactive?: boolean;
};

/** Typed dynamic import so TS accepts `center`, `zoom`, etc. */
const LeafletMap = dynamic<LeafletFooterMapProps>(
  () =>
    import('@/components/ui/leaflet-footer-map').then(
      (m) => m.LeafletFooterMap as unknown as React.ComponentType<LeafletFooterMapProps>
    ),
  { ssr: false }
);

/* ───────────────── helpers ───────────────── */
const geocodeCache = new Map<string, [number, number]>();

function isValidLatLng(v: any): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]);
}

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
        if (Array.isArray(data) && data.length) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            const parsed: [number, number] = [lat, lon];
            geocodeCache.set(address, parsed);
            setCoords(parsed);
          } else {
            setCoords(null);
          }
        } else {
          setCoords(null);
        }
      } catch {
        setCoords(null);
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

/* ───────────────── component ───────────────── */
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
  device?: EditorDevice;
}) {
  const final = (content || block?.content) as any;

  // Detect editor/preview context (iframe OR inline editor hints OR previewOnly)
  const inIframe =
    typeof window !== 'undefined' && typeof window.parent !== 'undefined' && window.parent !== window;

  const inlineHints =
    (typeof document !== 'undefined' && document.body?.classList?.contains?.('qs-editor')) ||
    (typeof window !== 'undefined' && (window as any).__QS_EDITOR__ === true) ||
    false;

  const enableFooterEdit = inIframe || inlineHints || previewOnly;

  /**
   * ⚠️ EDITOR HINTS MUST NOT REACH VISITORS. The published footer of a live business site read:
   *
   *     Company Info  —          Phone  —
   *     Find Us       Map unavailable   No social links yet.
   *
   * Every one of those is a message written for the OWNER, addressed to a customer. "No social
   * links yet." tells a prospect the business is half-built; "Map unavailable" tells them our
   * renderer failed; the em-dashes announce what we don't know about them. A persona evaluating
   * QuickSites through a demo site named exactly this as a reason not to trust it.
   *
   * Same rule as a missing backdrop, a dropped invalid block, and an unpainted image: where
   * there is nothing true to render, render NOTHING. The hint still shows in the editor, which
   * is the only place it was ever useful.
   */
  const showEditorHints = enableFooterEdit;

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

  // ⚠️ A PERSON IS NOT A COMPANY. The footer's three columns — "Company Info" (address,
  // Business, Phone), "Find Us" (a map) — are business chrome, and on an About-Me page built
  // from a résumé they rendered as "Business: Silver Zhao · Phone: — · Map unavailable".
  // Columns of em-dashes announcing everything we don't know about someone. A personal site
  // keeps the links and the contact it actually has, and drops the storefront furniture.
  const isPersonal =
    (typeof db.industry === 'string' && db.industry === 'personal') ||
    (typeof meta.industry === 'string' && meta.industry === 'personal') ||
    (typeof meta.site_type === 'string' && meta.site_type === 'personal');

  // A site WE built from a public listing, which the business has not claimed. `claimed` and
  // `guest_build` are somebody's own; these two are ours until someone takes them.
  const claimSource =
    (typeof db.claim_source === 'string' && db.claim_source) ||
    (typeof meta.claim_source === 'string' && meta.claim_source) ||
    '';
  const isUnclaimedDraft = claimSource === 'listing_import' || claimSource === 'operator_draft';

  // Optional, and deliberately never defaulted — see the note at the copyright line below.
  const tagline =
    (typeof final?.tagline === 'string' && final.tagline.trim()) ||
    (typeof meta.tagline === 'string' && meta.tagline.trim()) ||
    '';

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

  const fullAddressForGeocode =
    [addressLine1, addressLine2, city, state, postal].filter(Boolean).join(', ') || null;

  const latMeta = contact.latitude;
  const lonMeta = contact.longitude;
  const latDb = typeof db.latitude === 'number' ? db.latitude : Number(db.latitude);
  const lonDb = typeof db.longitude === 'number' ? db.longitude : Number(db.longitude);
  const lat = Number.isFinite(latMeta) ? latMeta : latDb;
  const lon = Number.isFinite(lonMeta) ? lonMeta : lonDb;

  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
  const geocoded = useGeocode(hasCoords ? null : fullAddressForGeocode);

  // Final, strictly validated center
  const coords = hasCoords ? [lat as number, lon as number] : geocoded;
  const centerOk = isValidLatLng(coords);

  const bgColor = 'bg-card';
  const textColor = 'text-card-foreground';
  const subText = 'text-muted-foreground';
  // ⚠️ NOT `text-primary`. The footer's background is `bg-card`, and `--primary` is the SITE'S
  // ACCENT — chosen per industry, per theme preset, or by the owner in the colour lab. Nothing
  // constrains an accent to contrast against a card, so a site whose accent is dark renders its
  // whole footer navigation at 1.71:1 on a dark theme: present in the DOM, legible to no one.
  // Found by a contrast check on the rendered page; invisible to `tsc`, to tests, and to reading
  // the source, which is the same shape as the SectionShell `text-white` bug in CLAUDE.md §7.
  //
  // The fix is the same as that one: emit the token that TRACKS the surface rather than a colour
  // that might collide with it. `text-card-foreground` is defined as readable on `bg-card` for
  // every theme, which is the guarantee an accent cannot make. Accent styling stays on the
  // underline, where a low-contrast colour is decoration rather than the text itself.
  const linkColor =
    'text-card-foreground underline-offset-4 hover:underline hover:decoration-primary hover:opacity-80';
  const headingColor = 'text-foreground';

  const socialStyle: SocialStyle = (() => {
    const raw = String(meta?.socialIcons || '').toLowerCase();
    if (raw === 'icons' || 'labels' || 'both') {
      if (raw === 'icons' || raw === 'labels' || raw === 'both') return raw as SocialStyle;
    }
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

  // Prevent navigation in editor, but DO NOT stop propagation (let root open handler fire)
  const maybePreventLink = enableFooterEdit
    ? {
        onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
        },
        tabIndex: -1,
      }
    : previewOnly
    ? { onClick: (e: React.MouseEvent<HTMLAnchorElement>) => e.preventDefault(), tabIndex: -1 }
    : {};

  /* ── One-click opener (capture phase) ─────────────────────────────── */
  const openedRef = useRef(0);
  const handleOpenCapture = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!enableFooterEdit) return;
      // Debounce duplicate firings from nested elements
      const now = Date.now();
      if (now - openedRef.current < 250) return;
      openedRef.current = now;

      // Don't navigate; open editor instead
      e.preventDefault();

      try { window.dispatchEvent(new CustomEvent('qs:edit-footer')); } catch {}
      try { window.parent?.postMessage?.({ type: 'qs:edit-footer' }, '*'); } catch {}
    },
    [enableFooterEdit]
  );

  if (compactMode) {
    return (
      <div
        className={`${bgColor} ${textColor} rounded p-3`}
        data-device={device || 'auto'}
        data-qseditor-footer={enableFooterEdit ? '1' : undefined}
        onPointerDownCapture={enableFooterEdit ? handleOpenCapture : undefined}
        title={enableFooterEdit ? 'Click to edit footer' : undefined}
        style={enableFooterEdit ? { cursor: 'pointer' } : undefined}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs">
            <p className="font-semibold leading-tight">{businessName}</p>
            <p className={subText}>{cityStatePostal}</p>
          </div>

          {/* quick socials (links prevented above) */}
          <div className="flex items-center gap-3">
            {socials.slice(0, 4).map((s) => (
              <a
                key={s.key}
                href={s.href}
                aria-label={s.aria}
                className={`${linkColor} inline-flex items-center gap-1`}
                {...maybePreventLink}
              >
                {renderSocialContent({ icon: s.icon, label: s.label })}
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const gridCols =
    device === 'tablet'
      ? 'grid-cols-2'
      : device === 'desktop'
      ? 'grid-cols-3'
      : 'grid-cols-1 md:grid-cols-3';

  return (
    <footer
      className={`${bgColor} ${textColor} border-t border-border px-6 py-10 text-sm mt-10`}
      data-device={device || 'auto'}
      data-qseditor-footer={enableFooterEdit ? '1' : undefined}
      onPointerDownCapture={enableFooterEdit ? handleOpenCapture : undefined}
      title={enableFooterEdit ? 'Click to edit footer' : undefined}
      style={enableFooterEdit ? { cursor: 'pointer' } : undefined}
    >
      <div className={`max-w-6xl mx-auto grid ${gridCols} gap-8`}>
        {/* Quick Links */}
        <div className="space-y-3">
          <h3 className={`text-base font-semibold ${headingColor}`}>Quick Links</h3>
          <nav className="grid gap-2">
            {links.length ? (
              links.map((l, i) =>
                l.href.startsWith('/') ? (
                  <Link
                    key={`${l.href}-${i}`}
                    href={previewOnly ? '#' : l.href}
                    className={linkColor}
                    {...maybePreventLink}
                  >
                    {l.label}
                  </Link>
                ) : (
                  <a
                    key={`${l.href}-${i}`}
                    href={previewOnly ? '#' : l.href}
                    className={linkColor}
                    {...maybePreventLink}
                  >
                    {l.label}
                  </a>
                )
              )
            ) : (
              showEditorHints && <span className={subText}>No links configured.</span>
            )}
          </nav>
        </div>

        {/* Company Info (read-only) — business sites only; see isPersonal above. */}
        <div className={`space-y-3 ${isPersonal ? 'hidden' : ''}`}>
          <h3 className={`text-base font-semibold ${headingColor}`}>Company Info</h3>
          {(fullAddressForDisplay || showEditorHints) && (
            <div className="whitespace-pre-line leading-relaxed">
              {fullAddressForDisplay || <span className={subText}>—</span>}
            </div>
          )}
          <div className="space-y-1">
            <div className={subText}>Business</div>
            <div>{businessName || <span className={subText}>—</span>}</div>
          </div>
          {(phone || showEditorHints) && (
            <div className="space-y-1">
              <div className={subText}>Phone</div>
              {phone ? (
                <a
                  href={previewOnly ? '#' : `tel:${(phone || '').replace(/\D/g, '')}`}
                  className={linkColor}
                  {...maybePreventLink}
                >
                  {phone}
                </a>
              ) : (
                <span className={subText}>—</span>
              )}
            </div>
          )}
        </div>

        {/* Map + Socials. On a personal page the map goes but the socials stay — links to
            someone's other work are the most useful thing in a portfolio footer. */}
        {/* A heading over nothing is its own kind of editor-speak: it tells a visitor a section
            exists and then shows them an empty box. With the map and the socials both gated
            above, this column can be genuinely empty — so hide the whole thing rather than
            leave "Find Us" hovering over blank space. */}
        <div className={`space-y-3 ${!centerOk && !socials.length && !showEditorHints ? 'hidden' : ''}`}>
          <h3 className={`text-base font-semibold ${headingColor}`}>{isPersonal ? 'Elsewhere' : 'Find Us'}</h3>
          {/* No map on a personal page: "Map unavailable" is a 180px box announcing that we
              don't know where someone lives — and on an About-Me page we have no business
              asking. */}
          <div className={`rounded-md overflow-hidden border border-border ${isPersonal ? 'hidden' : ''}`}>
            {centerOk ? (
              <LeafletMap
                center={coords as [number, number]}
                zoom={14}
                height={180}
                markerTitle={businessName}
                interactive={false}
              />
            ) : (
              showEditorHints && (
                <div className={`h-[180px] flex items-center justify-center ${subText}`}>
                  Map unavailable
                </div>
              )
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {socials.map((s) => (
              <a
                key={s.key}
                href={previewOnly ? '#' : s.href}
                aria-label={s.aria}
                className={`${linkColor} inline-flex items-center gap-1`}
                {...maybePreventLink}
              >
                {renderSocialContent({ icon: s.icon, label: s.label })}
              </a>
            ))}
            {!socials.length && showEditorHints && <span className={subText}>No social links yet.</span>}
          </div>
        </div>
      </div>

      {/*
        ⚠️ THIS TAGLINE USED TO BE UNCONDITIONAL. Every site in the fleet ended with
        "Fast, Reliable, Local Service 24/7." — including personal About-Me pages, where it
        appeared under a real person's name as though they were advertising 24-hour service.
        It is a trades slogan, and it is a CLAIM: nobody asked us to promise availability on
        their behalf. A résumé page reading "© 2026 Silver Zhao. Fast, Reliable, Local Service
        24/7." is the same category of error as a fabricated review, just quieter.

        Now it appears only where the site itself supplies it. No tagline is the safe default:
        a missing line reads as nothing, a wrong one reads as a promise.
      */}
      {/*
        ⚠️ AND THE COPYRIGHT LINE IS THE SAME ERROR, ONE STEP FURTHER — IT IS A LEGAL CLAIM MADE IN
        SOMEONE ELSE'S NAME. On a site we generated from a public listing, "© 2026 Enjoy Teriyaki"
        asserts that Enjoy Teriyaki claims ownership of a page they have never seen, did not ask
        for, and did not write. We wrote it. Putting their name on the assertion is not a courtesy;
        it is us signing a document as them.

        So an UNCLAIMED draft asserts nothing. Once a real owner claims the site the line returns,
        because by then it is true — they took it, they can edit it, and publishing it is their
        decision. Same rule the watermark and the noindex already follow: the page is honest about
        whose it is at each stage, rather than dressed as finished from the moment it exists.

        (The sibling case is above: a tagline nobody asked for. That one promises service; this one
        claims property. Both are claims made on a business's behalf by a machine that met them
        through a photo of their signboard.)
      */}
      {!isUnclaimedDraft && (
        <div className={`text-center mt-8 text-xs ${subText}`}>
          © {new Date().getFullYear()} {businessName}
          {tagline ? `. ${tagline}` : ''}
        </div>
      )}
    </footer>
  );
}
