// /app/order/[id]/packing-slip/page.tsx
export default async function PackingSlip({ params }:{ params:{ id:string } }) {
    // fetch order + items + merchant name (omitted for brevity)
    const token = '...'; // orders.review_token
    const base = process.env.APP_BASE_URL!;
    return (
      <html>
        <head><style>{`@page { size: 4in 6in; margin: 0.25in } body { font-family: ui-sans-serif }`}</style></head>
        <body>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'8px' }}>
            <div>
              <div style={{ fontSize:'14px', fontWeight:700 }}>delivered.menu</div>
              <div style={{ fontSize:'12px' }}>Thanks for your order!</div>
              <div style={{ fontSize:'11px', marginTop:'8px' }}>Scan to review your order</div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${base}/api/public/review/qr/${token}?size=300`} alt="review qr" style={{ width:'120px', height:'120px' }} />
          </div>
          {/* items table … */}
        </body>
      </html>
    );
  }
  