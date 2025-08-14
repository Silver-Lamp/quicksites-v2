'use client';

import { useEffect, useMemo, useState } from 'react';
import ShareMenu from '@/components/public/share-menu';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { composeHashtags } from '@/lib/hashtags';

type MealLite = {
  id: string;
  slug?: string | null;
  title: string;
  price_cents: number;
  cuisines?: string[] | null;
};
export default function ShareModal({
  open,
  onClose,
  meal,
  chefName,
}: {
  open: boolean;
  onClose: () => void;
  meal: MealLite;
  chefName?: string;
}) {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://delivered.menu');

  const handle = meal.slug || meal.id;
  const mealUrl = `${origin}/meals/${handle}`;
  const shareTitle = meal.title;
  const [mode, setMode] = useState<'available'|'upcoming'|'lastcall'>('available');
  const [dropAt, setDropAt] = useState(''); // ISO local datetime string
  const [useShort, setUseShort] = useState(false);
  const [shortUrl, setShortUrl] = useState<string>('');
  const [busyShort, setBusyShort] = useState(false);

  const price = `$${(meal.price_cents / 100).toFixed(2)}`;

  const tags = useMemo(() => {
    return composeHashtags({
      base: ['localfood','homemade'],
      cuisines: meal.cuisines || [],
      mealHashtags: (meal as any).hashtags || '',
      mode: ((meal as any).hashtags_mode as any) || 'append',
      cap: 6
    });
  }, [meal]);

  const caption = useMemo(() => {
    const hash = tags;
    if (mode === 'available') {
      return `🍽️ ${meal.title} by ${chefName || 'chef'} is LIVE on delivered.menu — ${price}. Limited portions.\n${hash}`;
    } else if (mode === 'upcoming') {
      const when = dropAt ? new Date(dropAt).toLocaleString() : 'soon';
      return `⏰ New drop: ${meal.title} by ${chefName || 'chef'} — going live ${when}.\nGet notified at the link.\n${hash}`;
    } else { // lastcall
      return `⏳ Last portions of ${meal.title} by ${chefName || 'chef'} — ${price}. Grab yours now.\n${hash}`;
    }
  }, [mode, dropAt, meal.title, chefName, price, tags]);

  async function ensureShort() {
    if (shortUrl || busyShort) return;
    setBusyShort(true);
    try {
      const r = await fetch('/api/chef/short-links/create', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ mealId: meal.id, longUrl: mealUrl })
      });
      const d = await r.json();
      if (r.ok && d?.shortUrl) setShortUrl(d.shortUrl);
    } catch {}
    setBusyShort(false);
  }

  useEffect(() => {
    if (open) {
      setMode('available');
      setUseShort(false);
      setShortUrl('');
      setDropAt('');
    }
  }, [open]);

  if (!open) return null;

  const baseShareUrl = useShort && shortUrl ? shortUrl : mealUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-2xl rounded-2xl bg-background border shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-base font-semibold">Share “{meal.title}”</h3>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        <div className="p-5 space-y-5">
          {/* Mode & time */}
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs">Post type:</Label>
            <div className="flex gap-2">
              <Button variant={mode==='available'?'default':'outline'} size="sm" onClick={()=>setMode('available')}>Available now</Button>
              <Button variant={mode==='upcoming'?'default':'outline'} size="sm" onClick={()=>setMode('upcoming')}>Upcoming</Button>
              <Button variant={mode==='lastcall'?'default':'outline'} size="sm" onClick={()=>setMode('lastcall')}>Last call</Button>
            </div>
            {mode==='upcoming' && (
              <div className="flex items-center gap-2">
                <Label className="text-xs" htmlFor="dropAt">When</Label>
                <Input id="dropAt" type="datetime-local" value={dropAt} onChange={(e)=>setDropAt(e.target.value)} className="h-8 w-56" />
              </div>
            )}
          </div>

          {/* Link controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs">Link:</Label>
            <code className="text-xs rounded bg-muted px-2 py-1">{baseShareUrl}</code>
            <Button
              variant="outline" size="sm"
              onClick={async ()=>{ await navigator.clipboard.writeText(baseShareUrl); }}
            >
              Copy link
            </Button>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={useShort}
                onChange={async (e)=>{ setUseShort(e.target.checked); if (e.target.checked) await ensureShort(); }}
              /> Use short link
            </label>
            <a
              className="rounded-md border px-2 py-1 text-xs"
              href={`/api/public/meal/${handle}/share-image?size=1080`}
              target="_blank" rel="noreferrer"
            >
              Download square image
            </a>
          </div>

          {/* Share buttons (adds UTMs per network, QR, Web Share) */}
          <ShareMenu url={baseShareUrl} title={shareTitle} chefName={chefName} />

          {/* Captions */}
          <div className="space-y-2">
            <Label className="text-xs">Suggested caption</Label>
            <Textarea value={caption} onChange={()=>{}} readOnly rows={4} />
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={async ()=>{ await navigator.clipboard.writeText(caption); }}
              >
                Copy caption
              </Button>
              <a
                className="rounded-md border px-3 py-1 text-sm"
                href={`${origin}/meals/${handle}/opengraph-image`}
                target="_blank" rel="noreferrer"
              >
                Preview link card
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
