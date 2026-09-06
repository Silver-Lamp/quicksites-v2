'use client';
// Refreshing is a real Google fetch across every connected property, so it is a deliberate button
// and not an effect on mount — a page that re-pulls Search Console every time someone opens it
// burns quota to tell a rep what it already knew.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** GSC finalises data on a lag; asking for today returns a window that is still filling in. */
const LAG_DAYS = 3;
const WINDOW_DAYS = 28;

function windowDates() {
  const end = new Date(Date.now() - LAG_DAYS * 86400000);
  const start = new Date(end.getTime() - (WINDOW_DAYS - 1) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end) };
}

export default function RefreshButton() {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setState('working');
    setMsg(null);
    const { startDate, endDate } = windowDates();
    try {
      const res = await fetch(
        `/api/gsc/performance/all?startDate=${startDate}&endDate=${endDate}&forceRefresh=true`,
        { method: 'GET' }
      );
      if (!res.ok) {
        // Say what went wrong and what to do, not "something went wrong".
        const body = await res.text();
        setState('error');
        setMsg(
          res.status === 401 || res.status === 403
            ? 'Not signed in as an admin — sign in and try again.'
            : `Google returned ${res.status}. ${body.slice(0, 140)}`
        );
        return;
      }
      setState('idle');
      setMsg(`Pulled ${startDate} → ${endDate}`);
      router.refresh();
    } catch (err: any) {
      setState('error');
      setMsg(err?.message ?? 'The request never completed.');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={refresh}
        disabled={state === 'working'}
        className="rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === 'working' ? 'Pulling Search Console…' : 'Refresh from Search Console'}
      </button>
      {msg && (
        <span className={state === 'error' ? 'text-xs text-red-400' : 'text-xs text-zinc-500'}>{msg}</span>
      )}
    </div>
  );
}
