// /app/api/public/meal/[handle]/share-image/route.tsx
import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
export const runtime = 'edge';

async function getMeal(handle: string) {
  const qs = new URLSearchParams({ slug: 'deliveredmenu' });
  const r = await fetch(`${process.env.APP_BASE_URL}/api/public/meal/${handle}?${qs}`, { cache: 'no-store' });
  return r.ok ? (await r.json()).meal : null;
}

export async function GET(req: NextRequest, { params }: { params: { handle: string } }) {
  const meal = await getMeal(params.handle);
  const size = Number(new URL(req.url).searchParams.get('size') || 1080);
  const title = (meal?.title || 'Meal').slice(0, 80);
  const price = meal ? `$${(meal.price_cents/100).toFixed(2)}` : '';
  const bg = meal?.image_url;

  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display:'flex', fontFamily:'system-ui, sans-serif' }}>
        <div style={{ position:'absolute', inset:0, background:'#111' }}>
          {bg ? <img src={bg} alt="" width={size} height={size}
            style={{ objectFit:'cover', width:'100%', height:'100%', filter:'brightness(0.55)' }} /> : null}
        </div>
        <div style={{ position:'relative', display:'flex', flexDirection:'column', gap:16, padding:56, color:'#fff' }}>
          <div style={{ fontSize: Math.round(size*0.08), fontWeight:800, lineHeight:1.1 }}>{title}</div>
          <div style={{ fontSize: Math.round(size*0.06), fontWeight:700, background:'#fff', color:'#111',
                        borderRadius:16, padding:'8px 18px', width:'fit-content' }}>{price}</div>
          <div style={{ marginTop:'auto', fontSize: Math.round(size*0.045) }}>delivered.menu</div>
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
