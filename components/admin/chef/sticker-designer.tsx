// /components/admin/chef/sticker-designer.tsx
'use client';
import { useEffect, useState } from 'react';

export default function StickerDesigner({ merchantId, merchantName }:{ merchantId:string, merchantName?:string }) {
  const [shape, setShape] = useState<'round'|'square'>('round');
  const [sizeIn, setSizeIn] = useState(2);

  const base = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL!;
  const singleUrl = `${base}/api/chef/sticker/merchant/${merchantId}?shape=${shape}&sizeIn=${sizeIn}`;
  const sheetUrl  = `${base}/chef/stickers/${merchantId}?shape=${shape}&sizeIn=${sizeIn}`;

  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <h3 className="text-base font-semibold">“Scan to review” stickers</h3>
      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm">Shape</label>
        <select className="rounded-md border px-2 py-1 text-sm" value={shape}
                onChange={(e)=>setShape(e.target.value as any)}>
          <option value="round">Round</option>
          <option value="square">Square</option>
        </select>
        <label className="text-sm">Size</label>
        <select className="rounded-md border px-2 py-1 text-sm" value={String(sizeIn)}
                onChange={(e)=>setSizeIn(Number(e.target.value))}>
          {[1.5,2,2.5,3].map(s => <option key={s} value={s}>{s}"</option>)}
        </select>
        <a className="rounded-md border px-3 py-1 text-sm" href={singleUrl} target="_blank">Download single (SVG)</a>
        <a className="rounded-md border px-3 py-1 text-sm" href={sheetUrl}  target="_blank">Open sheet (print)</a>
        <button
          className="rounded-md border px-3 py-1 text-sm"
          onClick={async () => { await fetch('/api/chef/review-code/regenerate', { method:'POST' }); location.reload(); }}
        >
          Regenerate code
        </button>
      </div>
      <div className="rounded-lg border p-3 bg-muted/30">
        <div className="text-xs text-muted-foreground">
          Tip: print at 100% scale (no “fit to page”). Round 2″ works well on most containers.
        </div>
      </div>
    </div>
  );
}
