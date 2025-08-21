'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

async function fetchMerchant(code: string) {
  const r = await fetch(`${process.env.APP_BASE_URL}/api/public/review/merchant-by-code/${code}`, { cache: 'no-store' });
  if (!r.ok) return null; const d = await r.json(); return d.merchant as { id:string, name:string } | null;
}

export default async function ReviewEntry({ params }: { params: { code: string } }) {
  const merchant = await fetchMerchant(params.code);
  if (!merchant) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold">Invalid QR</h1>
        <p className="text-sm text-muted-foreground">This review link is not active.</p>
      </div>
    );
  }

  // Minimal, client-side component will fetch recent meals for authed users
  return (
    <div className="mx-auto max-w-md p-6 space-y-4">
      <div className="text-center space-y-2">
        <div className="text-2xl font-semibold">Rate your meal</div>
        <div className="text-sm text-muted-foreground">for {merchant.name} on delivered.menu</div>
      </div>

      <ReviewChooser merchantId={merchant.id} code={params.code} />
      <p className="text-xs text-muted-foreground text-center">
        Reviews marked “Verified purchase” come from completed orders. <Link href="/login" className="underline">Sign in</Link> to verify.
      </p>
    </div>
  );
}

function Stars({ value, onChange }:{ value:number; onChange:(n:number)=>void }) {
  return (
    <div className="flex gap-1 justify-center">
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={()=>onChange(n)} className={n<=value ? 'text-yellow-500' : 'text-gray-300'}>★</button>
      ))}
    </div>
  );
}

function ReviewChooser({ merchantId, code }:{ merchantId:string; code:string }) {
  const [authed, setAuthed] = useState(false);
  const [meals, setMeals] = useState<{id:string; title:string}[]>([]);
  const [mealId, setMealId] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/auth/status'); // tiny route that returns {authed:true/false,email?:string}
      const s = await r.json(); setAuthed(!!s.authed);
      if (s.authed) {
        const q = await fetch(`/api/public/review/recent-meals?merchantId=${merchantId}`);
        const d = await q.json(); setMeals(d.meals || []);
      }
    })();
  }, [merchantId]);

  async function submit() {
    if (!mealId || !rating) return alert('Pick a meal and rating');
    const r = await fetch('/api/public/review/from-qr', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ code, mealId, rating, comment, email: authed ? undefined : (email || undefined) })
    });
    if (r.ok) {
      alert('Thanks for your feedback!');
      window.location.href = `/meals/${mealId}`; // jump back to meal page
    } else {
      const d = await r.json().catch(()=>({})); alert(d?.error || 'Could not submit');
    }
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <label className="text-sm font-medium">Which meal?</label>
      {authed ? (
        <select value={mealId} onChange={(e)=>setMealId(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm">
          <option value="">Select…</option>
          {meals.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
      ) : (
        <>
          <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Type the meal name"
                 value={mealId} onChange={(e)=>setMealId(e.target.value)} />
          <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Email (to verify purchase)"
                 value={email} onChange={(e)=>setEmail(e.target.value)} />
        </>
      )}

      <div className="pt-1">
        <Stars value={rating} onChange={setRating} />
      </div>
      <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={3}
                placeholder="Optional comment" value={comment} onChange={(e)=>setComment(e.target.value)} />
      <button onClick={submit} className="w-full rounded-md border px-3 py-2 text-sm">Submit review</button>
    </div>
  );
}
