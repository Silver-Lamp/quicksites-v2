// lib/og/siteOgCard.tsx
//
// Shared themed OG/thumbnail card for a site — used by the admin list thumbnail
// (app/api/public/showcase/[slug]/thumb) and the social OG image (app/og/[slug]).
// Renders the site's real hero image when present, else a themed accent card
// (accent glow + branded monogram + accent bar) using the site's curated theme,
// so the preview reflects the site's actual look instead of a flat gray letter.

import { ACCENT_HSL } from '@/lib/theme/accentHsl';

/** Tailwind accent token → an `hsla(...)` string satori understands. */
export function accentHsla(token: string | undefined | null, alpha: number): string {
  const triple = (token && ACCENT_HSL[token]) || ACCENT_HSL['sky-500'] || '199 89% 48%';
  const [h, s, l] = triple.split(/\s+/);
  return `hsla(${h}, ${s}, ${l}, ${alpha})`;
}

export type SiteOgCardProps = {
  name: string;
  industry?: string | null;
  hero?: string | null;
  accentToken?: string | null;
  darkMode?: boolean;
  /** Pixel size of the name — tune per aspect ratio (thumb vs social OG). */
  nameSize?: number;
  monogramSize?: number;
};

export function SiteOgCard({
  name,
  industry,
  hero,
  accentToken,
  darkMode = true,
  nameSize = 66,
  monogramSize = 340,
}: SiteOgCardProps) {
  const base = darkMode ? '#0a0a0f' : '#f4f4f5';
  const nameColor = hero ? '#ffffff' : darkMode ? '#ffffff' : '#18181b';
  const subColor = hero ? '#a1a1aa' : darkMode ? '#a1a1aa' : '#52525b';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: base }}>
      {hero ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hero}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: `radial-gradient(circle at 32% 30%, ${accentHsla(accentToken, 0.38)}, transparent 62%)`,
          }}
        >
          <div style={{ display: 'flex', fontSize: monogramSize, fontWeight: 800, color: accentHsla(accentToken, 0.32) }}>
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* readability gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0) 35%, ${darkMode ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.45)'} 100%)`,
        }}
      />

      {/* accent bar (bottom edge) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '100%',
          height: 8,
          display: 'flex',
          backgroundColor: accentHsla(accentToken, 1),
        }}
      />

      {/* badge */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 40,
          display: 'flex',
          alignItems: 'center',
          borderRadius: 9999,
          backgroundColor: 'rgba(9,9,11,0.72)',
          color: '#7dd3fc',
          padding: '10px 22px',
          fontSize: 26,
          fontWeight: 600,
        }}
      >
        Built with QuickSites
      </div>

      {/* identity */}
      <div style={{ position: 'absolute', left: 56, bottom: 48, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', color: nameColor, fontSize: nameSize, fontWeight: 800 }}>{name}</div>
        {industry ? (
          <div style={{ display: 'flex', color: subColor, fontSize: Math.round(nameSize * 0.52), marginTop: 8 }}>
            {industry}
          </div>
        ) : null}
      </div>
    </div>
  );
}
