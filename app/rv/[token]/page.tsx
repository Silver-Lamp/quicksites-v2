// /app/rv/[token]/page.tsx
import Link from 'next/link';

async function fetchOrderForToken(token: string) {
  const r = await fetch(`${process.env.APP_BASE_URL}/api/public/review/order/${token}`, { cache: 'no-store' });
  if (!r.ok) return null; return r.json();
}

export default async function ReviewOrderPage({ params }: { params:{ token:string } }) {
  const d = await fetchOrderForToken(params.token);
  if (!d) return <div className="mx-auto max-w-md p-6 text-center">
    <h1 className="text-xl font-semibold">Link not available</h1>
    <p className="text-sm text-muted-foreground">This review link is invalid or expired.</p>
  </div>;

  const { order, items } = d as { order:{ id:string, merchant_name:string, couponCode:string }, items: Array<{id:string, title:string, meal_id:string}> };

  return (
    <div className="mx-auto max-w-md p-6 space-y-4">
      <div className="text-center">
        <div className="text-2xl font-semibold">Rate your order</div>
        <div className="text-sm text-muted-foreground">from {order.merchant_name} on delivered.menu</div>
      </div>
      <ReviewClient token={params.token} items={items} />
      <p className="text-xs text-muted-foreground text-center">Verified review — linked to your order.</p>

    {/* // might need to move this */}
    {/* "Wherever you show a code (review thank-you page, email, badge), add a CTA:" */}
    {/* "This deep-links straight into the cart and auto-applies via the helper." */}
      <a
        className="rounded-md border px-3 py-1 text-sm text-center"
        href={`/cart?apply=${encodeURIComponent(order.couponCode)}`}
        >
        Apply at cart
      </a>

    </div>
  );
}

// ----- client -----
'use client';
import { useState } from 'react';

function Stars({ value, onChange }:{ value:number; onChange:(n:number)=>void }) {
  return <div className="flex gap-1 justify-center">
    {[1,2,3,4,5].map(n => <button key={n} onClick={()=>onChange(n)} className={n<=value?'text-yellow-500':'text-gray-300'}>★</button>)}
  </div>;
}

function ReviewClient({ token, items }:{ token:string; items:any[] }) {
  const [itemId, setItemId] = useState(items[0]?.id || '');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  async function submit() {
    if (!itemId || !rating) return alert('Pick an item and rating');
    const r = await fetch('/api/public/review/submit-by-token', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token, orderItemId: itemId, rating, comment })
    });
    const d = await r.json().catch(()=>({}));
    if (!r.ok) return alert(d?.error || 'Could not submit');
    alert('Thanks for your review!');
    window.location.href = `/meals/${d.mealHandle}`; // jump back to the meal
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <label className="text-sm font-medium">Which dish?</label>
      <select value={itemId} onChange={(e)=>setItemId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
        {items.map((it:any)=> <option key={it.id} value={it.id}>{it.title}</option>)}
      </select>
      <Stars value={rating} onChange={setRating} />
      <textarea rows={3} value={comment} onChange={(e)=>setComment(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Optional comment" />
      <button onClick={submit} className="w-full rounded-md border px-3 py-2 text-sm">Submit review</button>
    </div>
  );
}
