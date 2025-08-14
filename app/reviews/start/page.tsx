import React from 'react';

async function verify(token: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/public/reviews/verify?token=${token}`, { cache: 'no-store' });
  return res.json();
}

export default async function ReviewStartPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams?.token || '';
  const data = token ? await verify(token) : { error: 'token_missing' };

  if (data.error) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <h1 className="text-xl font-semibold mb-2">Write a Review</h1>
        <p className="text-sm text-red-600">{data.error === 'token_missing' ? 'This link is missing a token.' : data.error.replace('_',' ')}</p>
      </div>
    );
  }

  const meal = data.meal;
  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        {meal?.image_url && <img src={meal.image_url} alt="" className="w-16 h-12 object-cover rounded-md border"/>}
        <div>
          <h1 className="text-xl font-semibold">Review {meal?.title}</h1>
          <p className="text-xs text-muted-foreground">Thanks for supporting our chefs!</p>
        </div>
      </div>

      <form id="review-form" className="space-y-3" onSubmit={async (e)=>{
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        const fd = new FormData(form);
        const payload = {
          token: fd.get('token'),
          rating: Number(fd.get('rating')),
          user_name: String(fd.get('user_name')||''),
          comment: String(fd.get('comment')||'')
        };
        const r = await fetch('/api/public/reviews/submit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if (r.ok) {
          (document.getElementById('ok') as HTMLDivElement).style.display = 'block';
          (document.getElementById('formwrap') as HTMLDivElement).style.display = 'none';
        } else {
          const d = await r.json();
          alert(d.error || 'Unable to submit review');
        }
      }}>
        <input type="hidden" name="token" value={token} />
        <div id="formwrap" className="space-y-3">
          <div>
            <label className="text-sm font-medium">Rating</label>
            <select name="rating" className="border rounded-md px-2 py-1 w-full">
              <option value="5">★★★★★ (5)</option>
              <option value="4">★★★★☆ (4)</option>
              <option value="3">★★★☆☆ (3)</option>
              <option value="2">★★☆☆☆ (2)</option>
              <option value="1">★☆☆☆☆ (1)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Your name (optional)</label>
            <input name="user_name" className="border rounded-md px-2 py-1 w-full" />
          </div>
          <div>
            <label className="text-sm font-medium">Comment (optional)</label>
            <textarea name="comment" rows={4} className="border rounded-md px-2 py-1 w-full" placeholder="What did you like?" />
          </div>
          <button className="border rounded-md px-3 py-1">Submit review</button>
        </div>
      </form>

      <div id="ok" style={{display:'none'}} className="mt-4 text-green-700 text-sm">
        Thank you! Your review was submitted.
      </div>
    </div>
  );
}
