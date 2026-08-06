'use client';

// Outreach history for one subject — paste what you sent, attach what you sent it with, read it back.
//
// ⚠️ THE PASTE BOX IS THE PRODUCT. Everything else here is chrome around one job: getting the
// EXACT words into the record while you still have them on your clipboard. Three weeks later
// "what did I quote them?" is unanswerable from a timestamp, which is what we had.
//
// ⚠️ IT ASKS WHEN IT HAPPENED, not just what. An operator logging yesterday's phone call today
// must be able to say so, or the history silently becomes a log of data entry.
import * as React from 'react';

type Touch = {
  id: string; direction: 'outbound' | 'inbound'; channel: string; body: string;
  attachment_url: string | null; attachment_name: string | null; occurred_at: string;
};

const CHANNELS = ['sms', 'email', 'call', 'in_person', 'postcard', 'other'];

export default function TouchLog({
  templateId, prospectId, subjectLabel, title = 'Outreach history',
}: {
  templateId?: string | null; prospectId?: string | null; subjectLabel?: string | null; title?: string;
}) {
  const [touches, setTouches] = React.useState<Touch[]>([]);
  const [body, setBody] = React.useState('');
  const [channel, setChannel] = React.useState('sms');
  const [direction, setDirection] = React.useState<'outbound' | 'inbound'>('outbound');
  const [occurredAt, setOccurredAt] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const qs = React.useMemo(() => {
    const p = new URLSearchParams();
    if (templateId) p.set('templateId', templateId);
    else if (prospectId) p.set('prospectId', prospectId);
    else if (subjectLabel) p.set('label', subjectLabel);
    return p.toString();
  }, [templateId, prospectId, subjectLabel]);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/admin/outreach/touches?${qs}`);
    const json = await res.json().catch(() => ({}));
    setTouches(json?.touches ?? []);
  }, [qs]);

  React.useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (busy || !body.trim()) return;
    setBusy(true); setError(null);
    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.set('file', file);
        const up = await fetch('/api/admin/outreach/touches/attachment', { method: 'POST', body: fd });
        const uj = await up.json().catch(() => ({}));
        if (!up.ok || !uj?.url) throw new Error(uj?.error || 'Attachment failed — nothing was saved.');
        attachmentUrl = uj.url; attachmentName = file.name;
      }
      const res = await fetch('/api/admin/outreach/touches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId, prospectId, subjectLabel, direction, channel, body,
          attachmentUrl, attachmentName, occurredAt: occurredAt || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Could not save.');
      setBody(''); setFile(null); setOccurredAt('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const when = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <select value={direction} onChange={(e) => setDirection(e.target.value as any)}
          className="rounded-lg border border-border bg-background px-2 py-1 text-foreground">
          <option value="outbound">I sent</option>
          <option value="inbound">They replied</option>
        </select>
        <select value={channel} onChange={(e) => setChannel(e.target.value)}
          className="rounded-lg border border-border bg-background px-2 py-1 text-foreground">
          {CHANNELS.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
        {/* Optional: when it actually happened. Blank means now. */}
        <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)}
          title="When it happened — leave blank for now"
          className="rounded-lg border border-border bg-background px-2 py-1 text-foreground" />
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Paste exactly what was sent or received…"
        className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/60"
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-muted/40 file:px-2 file:py-1 file:text-xs file:text-foreground" />
        <button type="button" onClick={save} disabled={busy || !body.trim()}
          className="rounded-lg bg-sky-400 px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-sky-300 disabled:opacity-40">
          {busy ? 'Saving…' : 'Log it'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>

      <ul className="mt-4 space-y-2">
        {touches.length === 0 && (
          <li className="text-xs text-muted-foreground">Nothing logged yet.</li>
        )}
        {touches.map((t) => (
          <li key={t.id} className={`rounded-xl border p-3 ${t.direction === 'inbound' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-muted/20'}`}>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{t.direction === 'inbound' ? 'They replied' : 'I sent'}</span>
              <span>· {t.channel}</span>
              <span>· {when(t.occurred_at)}</span>
              {t.attachment_url && (
                <a href={t.attachment_url} target="_blank" rel="noreferrer" className="underline">
                  {t.attachment_name || 'attachment'}
                </a>
              )}
            </div>
            {/* Verbatim, never truncated in storage; wrapped for reading. */}
            <p className="mt-1 whitespace-pre-line text-sm text-foreground">{t.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
