// app/for-sales/opengraph-image.tsx
//
// The share card for /for-sales (owner, 2026-10-11: "need better OG sharing image" — the default
// was the wordmark blown up to a blur). Rendered by Next at /for-sales/opengraph-image: the h1
// and the two pitches, in the page's own words and palette. No photo, no figure, no claim beyond
// what the page itself says; the copy is imported, not retyped, so it cannot drift.
import { ImageResponse } from 'next/og';
import { FOR_SALES_PITCHES } from '@/lib/sales/forSalesPitches';

export const runtime = 'nodejs';
export const alt = 'QuickSites — Spread the word. Earn for life.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #09090b 0%, #0f172a 100%)',
          color: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, color: '#a1a1aa' }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: '#34d399' }} />
          QuickSites · commission sales
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ fontSize: 70, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Spread the word. Earn for life.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 30, lineHeight: 1.3, color: '#d4d4d8' }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <span style={{ color: '#34d399' }}>›</span>
              <span>{FOR_SALES_PITCHES.lunch}</span>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <span style={{ color: '#34d399' }}>›</span>
              <span>{FOR_SALES_PITCHES.business}</span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 24, color: '#71717a' }}>quicksites.ai/for-sales</div>
      </div>
    ),
    { ...size },
  );
}
