// /components/public/share-menu.tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

function buildUrl(base: string, utm: Record<string,string>) {
  const u = new URL(base);
  Object.entries(utm).forEach(([k,v]) => u.searchParams.set(k, v));
  return u.toString();
}

export default function ShareMenu({
  url, title, chefName, networkDefault = 'x', utmBase = { utm_source:'chef', utm_medium:'social' },
}: {
  url: string; title: string; chefName?: string; networkDefault?: 'x'|'facebook'|'whatsapp';
  utmBase?: Record<string,string>;
}) {
  const [copyOk, setCopyOk] = useState(false);
  const [qr, setQr] = useState<string>('');

  const links = useMemo(() => {
    const forNet = (net: string) => buildUrl(url, { ...utmBase, utm_campaign:'meal_share', utm_content: net });
    const uX = forNet('x');
    const uFB = forNet('facebook');
    const uWA = forNet('whatsapp');
    const text = encodeURIComponent(`${title} by ${chefName || 'chef'} — order on delivered.menu`);
    return {
      x: `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(uX)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(uFB)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${decodeURIComponent(text)} ${uWA}`)}`,
      sms: `sms:?&body=${encodeURIComponent(`${decodeURIComponent(text)} ${uX}`)}`,
      directX: uX,
    };
  }, [url, title, chefName, utmBase]);

  useEffect(() => {
    (async () => setQr(await QRCode.toDataURL(links.directX, { margin: 1 })))();
  }, [links.directX]);

  return (
    <div className="flex flex-wrap gap-2">
      <a className="rounded-md border px-3 py-1 text-sm" href={links.x} target="_blank" rel="noreferrer">Share on X</a>
      <a className="rounded-md border px-3 py-1 text-sm" href={links.facebook} target="_blank" rel="noreferrer">Facebook</a>
      <a className="rounded-md border px-3 py-1 text-sm" href={links.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
      <a className="rounded-md border px-3 py-1 text-sm" href={links.sms}>SMS</a>
      <button className="rounded-md border px-3 py-1 text-sm"
        onClick={async () => { await navigator.clipboard.writeText(links.directX); setCopyOk(true); setTimeout(()=>setCopyOk(false), 1200); }}>
        {copyOk ? 'Copied!' : 'Copy link'}
      </button>
      {'share' in navigator ? (
        <button className="rounded-md border px-3 py-1 text-sm"
          onClick={() => navigator.share({ title, text: `${title} — delivered.menu`, url: links.directX })}>
          Share…
        </button>
      ) : null}
      {qr ? <img src={qr} alt="QR" className="h-9 w-9 rounded border" /> : null}
    </div>
  );
}
