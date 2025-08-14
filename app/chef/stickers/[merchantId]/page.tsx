export default async function StickerSheet({ params, searchParams }:{
    params:{ merchantId:string }, searchParams:{ shape?:string, sizeIn?:string }
  }) {
    const shape = (searchParams.shape || 'round') as 'round'|'square';
    const sizeIn = Number(searchParams.sizeIn || '2');
    const cols = 4, rows = 5; // 2" fits ~4x5 with margins on Letter
    const gapIn = 0.25;
    const cellW = sizeIn + gapIn, cellH = sizeIn + gapIn;
  
    const stickers = [];
    for (let r=0;r<rows;r++) {
      for (let c=0;c<cols;c++) {
        stickers.push(
          <div key={`${r}-${c}`} style={{
            width: `${sizeIn}in`, height: `${sizeIn}in`,
            display:'flex', alignItems:'center', justifyContent:'center'
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/chef/sticker/merchant/${params.merchantId}?shape=${shape}&sizeIn=${sizeIn}`}
              alt="sticker" style={{ width:'100%', height:'100%' }} />
          </div>
        );
      }
    }
  
    return (
      <html>
        <head>
          <style>{`
            @page { size: Letter; margin: 0.5in; }
            body { margin: 0; }
            .sheet { display: grid; grid-template-columns: repeat(${cols}, ${cellW}in);
                     grid-auto-rows: ${cellH}in; gap: ${gapIn}in; }
            @media screen { body { background:#f6f7f8; } .page { box-shadow: 0 0 0 1px #ddd inset; } }
          `}</style>
        </head>
        <body>
          <div className="page" style={{ width:'8.5in', height:'11in', margin:'0 auto', padding:'0.25in' }}>
            <div className="sheet">
              {stickers}
            </div>
          </div>
        </body>
      </html>
    );
  }
  