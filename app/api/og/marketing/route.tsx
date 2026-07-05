// app/api/og/marketing/route.tsx
//
// Branded Open Graph / Twitter card for QuickSites marketing pages (1200x630).
// Wired via lib/marketingOg.ts from the homepage, /partners, /compare,
// /pricing, etc. Customize per page with ?eyebrow= / ?title= / ?subtitle= —
// defaults to the homepage message. Text-only (no image fetch) so it always
// renders.
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const clamp = (s: string | null, max: number) =>
  (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const SKY = '#0ea5e9';
// Validate ?accent so nothing untrusted lands in the rendered SVG.
const safeAccent = (v: string | null): string => (v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : SKY);
const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // Brand-aware: a reseller org can pass ?brand / ?accent / ?domain to get its
  // own card; defaults are QuickSites.
  const brand = clamp(searchParams.get('brand'), 40) || 'QuickSites';
  const domain = clamp(searchParams.get('domain'), 60) || 'quicksites.ai';
  const accent = safeAccent(searchParams.get('accent'));
  const initial = brand.charAt(0).toUpperCase() || 'Q';
  const eyebrow = clamp(searchParams.get('eyebrow'), 60) || domain;
  const title = clamp(searchParams.get('title'), 90) || 'One-Click Local Websites';
  const subtitle =
    clamp(searchParams.get('subtitle'), 160) ||
    'Launch a professional site for your local business in minutes — AI-assisted, with built-in commerce.';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0a0a0a',
          backgroundImage: `radial-gradient(900px 500px at 82% -8%, ${rgba(accent, 0.22)}, transparent 60%), radial-gradient(700px 500px at -6% 108%, ${rgba(accent, 0.12)}, transparent 55%)`,
          padding: '72px 80px',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        {/* wordmark */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 18,
              fontSize: 30,
              fontWeight: 800,
              color: '#0a0a0a',
            }}
          >
            {initial}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>{brand}</div>
        </div>

        {/* headline block */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 3,
              color: accent,
              marginBottom: 20,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 940,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              lineHeight: 1.35,
              color: 'rgba(255,255,255,0.72)',
              marginTop: 24,
              maxWidth: 900,
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* footer accent */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 64, height: 6, borderRadius: 999, backgroundColor: accent, marginRight: 20 }} />
          <div style={{ fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
            {domain}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'cache-control': 'public, immutable, no-transform, max-age=86400',
      },
    },
  );
}
