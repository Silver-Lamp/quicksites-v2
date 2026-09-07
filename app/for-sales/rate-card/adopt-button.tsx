'use client';
// One click to register a live, ranked domain as rentable inventory.
//
// ⚠️ Every refusal is rendered in full rather than collapsed to "failed". They are all fixable data
// gaps — no city on the site, an industry that would underprice it permanently, an unpublished
// template — and the operator reading this is the person who can fix them. A toast saying
// "something went wrong" would send them to the logs to rediscover what the server already knew.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdoptButton({ host, campaignId }: { host: string; campaignId?: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'working' | 'refused'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  if (campaignId) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400" title={campaignId}>
        ✓ campaign
      </span>
    );
  }

  async function adopt() {
    setState('working');
    setMsg(null);
    try {
      const res = await fetch('/api/admin/sales/adopt-domain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ host }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState('refused');
        setMsg(json?.error ?? `Refused (${res.status}).`);
        return;
      }
      setState('idle');
      setMsg(
        `Registered as a campaign${Array.isArray(json.notes) && json.notes.length ? ` — ${json.notes.join(' ')}` : ''}`,
      );
      router.refresh();
    } catch (err: any) {
      setState('refused');
      setMsg(err?.message ?? 'The request never completed.');
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={adopt}
        disabled={state === 'working'}
        className="rounded border border-zinc-600 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-zinc-300 transition hover:border-emerald-500/60 hover:text-emerald-300 disabled:opacity-50"
      >
        {state === 'working' ? 'registering…' : 'make rentable'}
      </button>
      {msg && (
        <span
          className={`max-w-[22rem] text-right text-[11px] leading-snug ${
            state === 'refused' ? 'text-amber-400' : 'text-emerald-400'
          }`}
        >
          {msg}
        </span>
      )}
    </div>
  );
}
