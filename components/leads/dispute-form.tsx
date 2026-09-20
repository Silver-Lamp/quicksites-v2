'use client';
// components/leads/dispute-form.tsx — "Contest this charge" on the statement page. One reason
// from the fixed list, a sentence or two, submit. The server checks the window and the token.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES: Array<[string, string]> = [
  ['GEO', 'Out of my service area'],
  ['SVC', 'Not a service I offer'],
  ['DUP', 'Same caller, already counted'],
  ['EXC', 'Existing customer, not a new lead'],
  ['SPM', 'Spam, sales call or wrong number'],
  ['DUR', 'We did not actually talk'],
  ['OTHER', 'Something else'],
];

export default function DisputeForm({ token, ledgerId }: { token: string; ledgerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('GEO');
  const [explanation, setExplanation] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-border px-2 py-1 hover:bg-muted"
      >
        Contest this charge
      </button>
    );
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/leads/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ledgerId, category, explanation }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setMsg('Sent — we review within two business days and email you either way.');
      router.refresh();
    } catch (err: any) {
      setMsg(err?.message || 'failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mt-2 w-full space-y-2 rounded-lg border border-border bg-background p-3"
    >
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
      >
        {CATEGORIES.map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        required
        minLength={10}
        maxLength={2000}
        rows={3}
        placeholder="What happened on the call? (a sentence or two)"
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Submit dispute'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:underline"
        >
          cancel
        </button>
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </div>
    </form>
  );
}
