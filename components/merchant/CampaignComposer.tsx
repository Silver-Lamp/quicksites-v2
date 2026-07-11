'use client';

// Compose + send a customer email campaign (CRM_PLAN.md Phase 3). Pick a segment,
// preview the (consent-gated) recipient count, send a test to yourself, then send.
// All sends require marketing consent — enforced server-side in resolveAudience.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SEGMENTS, type Segment } from '@/lib/crm/segments';

export default function CampaignComposer({ merchantId, tags }: { merchantId: string; tags: string[] }) {
  const router = useRouter();
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [seg, setSeg] = React.useState<Segment>('opted_in');
  const [tag, setTag] = React.useState('');
  const [count, setCount] = React.useState<number | null>(null);
  const [overCap, setOverCap] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = React.useState(0);
  const [busy, setBusy] = React.useState<null | 'preview' | 'test' | 'send'>(null);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function post(action: 'preview' | 'test' | 'send') {
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch('/api/merchant/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ merchantId, action, subject, body, segment: { seg, tag: tag || null } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);
      return json;
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message || 'Failed' });
      return null;
    } finally {
      setBusy(null);
    }
  }

  // Re-preview whenever the audience definition changes (or a manual retry).
  React.useEffect(() => {
    let alive = true;
    setCount(null);
    setPreviewError(null);
    (async () => {
      try {
        const res = await fetch('/api/merchant/campaigns', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ merchantId, action: 'preview', segment: { seg, tag: tag || null } }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);
        if (typeof json.recipientCount !== 'number') throw new Error('Unexpected response.');
        if (!alive) return;
        setCount(json.recipientCount);
        setOverCap(!!json.overCap);
      } catch (e: any) {
        if (!alive) return;
        setCount(null);
        setPreviewError(e?.message || 'Could not estimate the audience.');
      }
    })();
    return () => { alive = false; };
  }, [merchantId, seg, tag, previewNonce]);

  const canSend = subject.trim() && body.trim() && (count ?? 0) > 0 && !overCap;

  async function onSend() {
    if (!canSend) return;
    if (!confirm(`Send this email to ${count} opted-in customer${count === 1 ? '' : 's'}? This cannot be undone.`)) return;
    const json = await post('send');
    if (json?.ok) {
      setMsg({ kind: 'ok', text: `Sent to ${json.sent} recipient${json.sent === 1 ? '' : 's'}${json.failed ? `, ${json.failed} failed` : ''}.` });
      setSubject(''); setBody('');
      router.refresh();
    }
  }

  async function onTest() {
    const json = await post('test');
    if (json?.ok) setMsg({ kind: 'ok', text: `Test sent to ${json.testTo}.` });
  }

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h2 className="text-sm font-semibold text-neutral-200">New campaign</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-neutral-400">
          Audience
          <select
            value={seg}
            onChange={(e) => setSeg(e.target.value as Segment)}
            className="mt-1 w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm text-neutral-200 ring-1 ring-neutral-800 focus:outline-none focus:ring-neutral-600"
          >
            {SEGMENTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-neutral-400">
          Tag (optional)
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            disabled={tags.length === 0}
            className="mt-1 w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm text-neutral-200 ring-1 ring-neutral-800 focus:outline-none focus:ring-neutral-600 disabled:opacity-50"
          >
            <option value="">Any tag</option>
            {tags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-2 text-xs text-neutral-500">
        {previewError ? (
          <span className="text-red-400">
            Couldn’t estimate the audience ({previewError}).{' '}
            <button
              type="button"
              onClick={() => setPreviewNonce((n) => n + 1)}
              className="underline underline-offset-2 hover:text-red-300"
            >
              Retry
            </button>
          </span>
        ) : count === null ? 'Estimating audience…' : (
          <>
            <span className="text-neutral-300">{count}</span> opted-in recipient{count === 1 ? '' : 's'} match.
            {overCap && <span className="text-amber-400"> Over the per-send cap — narrow the segment.</span>}
            {count === 0 && <span className="text-amber-400"> Only customers who opted in to marketing receive campaigns.</span>}
          </>
        )}
      </div>

      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        maxLength={200}
        className="mt-4 w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm text-neutral-200 ring-1 ring-neutral-800 placeholder:text-neutral-600 focus:outline-none focus:ring-neutral-600"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={7}
        maxLength={10000}
        placeholder={"Write your message…\n\nBlank lines start a new paragraph. An unsubscribe link is added automatically."}
        className="mt-2 w-full resize-y rounded-lg bg-neutral-900 px-3 py-2 text-sm text-neutral-200 ring-1 ring-neutral-800 placeholder:text-neutral-600 focus:outline-none focus:ring-neutral-600"
      />

      {msg && (
        <div className={`mt-3 rounded-md px-3 py-2 text-sm ${msg.kind === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend || busy !== null}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            canSend && busy === null ? 'bg-sky-500 text-zinc-950 hover:bg-sky-400' : 'cursor-not-allowed bg-white/5 text-neutral-500'
          }`}
        >
          {busy === 'send' ? 'Sending…' : `Send${count ? ` to ${count}` : ''}`}
        </button>
        <button
          type="button"
          onClick={onTest}
          disabled={!subject.trim() || !body.trim() || busy !== null}
          className="rounded-md border border-white/15 px-4 py-2 text-sm text-neutral-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === 'test' ? 'Sending…' : 'Send test to me'}
        </button>
      </div>
    </div>
  );
}
