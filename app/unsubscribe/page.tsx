'use client';
import { useEffect, useState } from 'react';

export default function UnsubPage() {
  const [state, setState] = useState<'doing'|'ok'|'fail'>('doing');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setState('fail'); return; }
    (async () => {
      const r = await fetch('/api/public/waitlist/unsubscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      setState(r.ok ? 'ok' : 'fail');
    })();
  }, []);

  return (
    <div className="mx-auto max-w-md p-8">
      {state === 'doing' && <p>Updating your preferences…</p>}
      {state === 'ok'    && <p>You’ve been unsubscribed. You won’t receive more alerts for this meal.</p>}
      {state === 'fail'  && <p>We couldn’t process that link. Please try again later.</p>}
    </div>
  );
}
