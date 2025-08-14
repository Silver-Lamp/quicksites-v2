// /app/meals/[handle]/opengraph-image.tsx
import { ImageResponse } from 'next/og';
export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function getMeal(handle: string) {
  const qs = new URLSearchParams({ slug: 'deliveredmenu' }); // derive from host/tenant in your app
  const r = await fetch(`${process.env.APP_BASE_URL}/api/public/meal/${handle}?${qs}`, { cache: 'no-store' });
  return r.ok ? (await r.json()).meal : null;
}

export default async function Image({ params }: { params: { handle: string } }) {
  const meal = await getMeal(params.handle);
  const title = (meal?.title || 'Meal').slice(0, 80);
  const price = meal ? `$${(meal.price_cents/100).toFixed(2)}` : '';
  const chef = meal?.merchant?.name || 'Chef';
  const bg = meal?.image_url;

  return new ImageResponse(
    (
      <div style={{ width: '1200px', height: '630px', display:'flex', fontFamily: 'system-ui, sans-serif' }}>
        {/* background */}
        <div style={{
          position:'absolute', inset:0, background:'#111', overflow:'hidden'
        }}>
          {bg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bg} alt="" width="1200" height="630"
                 style={{ objectFit:'cover', width:'100%', height:'100%', filter:'brightness(0.6)' }} />
          ) : null}
        </div>

        {/* content */}
        <div style={{ position:'relative', display:'flex', flexDirection:'column', gap:16, padding:48, color:'#fff' }}>
          <div style={{ fontSize: 54, lineHeight:1.1, fontWeight: 700 }}>{title}</div>
          <div style={{ display:'flex', gap:20, alignItems:'center' }}>
            <div style={{ fontSize: 36, fontWeight: 700, padding:'6px 14px', background:'#fff', color:'#111', borderRadius:12 }}>{price}</div>
            <div style={{ fontSize: 28, opacity: 0.9 }}>by {chef}</div>
          </div>
          <div style={{ marginTop:'auto', display:'flex', alignItems:'center', gap:12, opacity:0.95 }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>delivered.menu</div>
            <div style={{ width:6, height:6, borderRadius:999, background:'#fff', opacity:0.6 }} />
            <div style={{ fontSize: 24 }}>Order now or get notified</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
