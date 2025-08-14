'use client';
import { useEffect, useRef, useState } from 'react';

export default function NotifyInline({ mealId }: { mealId: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cfToken, setCfToken] = useState('');
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    const id = 'cf-turnstile';
    const mount = () => {
      // @ts-ignore
      window?.turnstile?.render(ref.current, { sitekey: siteKey, callback: (t: string) => setCfToken(t) });
    };
    if (!document.getElementById(id)) {
      const s = document.createElement('script');
      s.id = id;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = mount;
      document.head.appendChild(s);
    } else mount();
  }, [siteKey]);

  if (done) return <span className="text-xs text-emerald-700">We’ll email you when it’s back.</span>;

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setErr(null);
        const r = await fetch('/api/public/waitlist/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mealId, email, cfToken })
        });
        setBusy(false);
        if (r.ok) setDone(true);
        else {
          const d = await r.json().catch(()=>({}));
          setErr(d?.error || 'Could not subscribe');
        }
      }}
    >
      <input type="email" required placeholder="you@example.com"
             value={email} onChange={(e)=>setEmail(e.target.value)}
             className="w-48 rounded-md border px-2 py-1 text-xs" />
      {siteKey ? <div ref={ref} className="hidden" /> : null}
      <button className="rounded-md border px-3 py-1 text-xs" disabled={busy} type="submit">
        {busy ? 'Adding…' : 'Notify me'}
      </button>
      {err && <span className="text-xs text-rose-600">{err}</span>}
    </form>
  );
}
