'use client';
// components/admin/ppl-attach-number-form.tsx — point an existing Twilio number at a campaign
// from /admin/ppl. The production process holds the Twilio creds (they are write-only in
// Vercel), so this is the only place the repoint can be done. The notice checkbox is the
// operator's call at click time: on by default, off when the business already agreed in person.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PplAttachNumberForm({
  campaigns,
  numbers,
}: {
  campaigns: Array<{
    id: string;
    domain: string;
    forward_to: string | null;
    tracking_number: string | null;
  }>;
  numbers: string[];
}) {
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [phone, setPhone] = useState('');
  const [forwardTo, setForwardTo] = useState('');
  const [sendNotice, setSendNotice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const picked = campaigns.find(
    (c) =>
      c.domain ===
      domain
        .trim()
        .toLowerCase()
        .replace(/^www\./, '')
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) {
      setResult('pick a campaign domain from the list');
      return;
    }
    const fwd = forwardTo.trim() || picked.forward_to || '';
    if (
      !window.confirm(
        `Point ${phone} at ${picked.domain}, forwarding to ${fwd || '(none)'}${sendNotice ? ', and text that number the one-time notice' : ''}?`
      )
    )
      return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch('/api/admin/prospects/geo-campaign/attach-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: picked.id,
          phoneNumber: phone.trim(),
          forwardTo: fwd || undefined,
          sendNotice,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      const notice = j.notice?.sent
        ? 'notice sent'
        : `notice not sent (${j.notice?.reason ?? '?'})`;
      setResult(
        `attached — voice → ${j.voiceUrl}; was ${j.previous?.voiceApplicationSid ? `flow ${j.previous.voiceApplicationSid}` : j.previous?.voiceUrl || 'unset'}${j.previous?.accountSid ? `; moved from subaccount ${j.previous.accountSid}` : ''}; ${notice}`
      );
      router.refresh();
    } catch (err: any) {
      setResult(err?.message || 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 grid gap-3 rounded-xl border border-border bg-card p-4 text-sm text-card-foreground sm:grid-cols-2 lg:grid-cols-5"
    >
      <label className="grid gap-1 text-xs text-muted-foreground">
        Campaign domain
        <input
          list="ppl-campaign-domains"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="graftontowing.com"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        <datalist id="ppl-campaign-domains">
          {campaigns.map((c) => (
            <option key={c.id} value={c.domain} />
          ))}
        </datalist>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Twilio number
        {/* A real <select>, not a datalist: Chrome filters datalist suggestions by the text
            already in the box, so a prefilled number hid every other number on the account. */}
        <select
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="">Choose a number…</option>
          {numbers.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Forward to (E.164){picked?.forward_to ? ` — campaign has ${picked.forward_to}` : ''}
        <input
          value={forwardTo}
          onChange={(e) => setForwardTo(e.target.value)}
          placeholder={picked?.forward_to ?? '+1…'}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <label className="flex items-end gap-2 pb-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={sendNotice}
          onChange={(e) => setSendNotice(e.target.checked)}
        />
        Text the one-time notice
      </label>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={busy || !phone}
          className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? 'Attaching…' : 'Attach number'}
        </button>
      </div>
      {result ? (
        <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">{result}</p>
      ) : null}
    </form>
  );
}
