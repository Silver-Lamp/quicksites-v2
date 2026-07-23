'use client';

// components/service-jobs/job-portal-client.tsx
//
// The customer's view of a SecondSet service job: glasses-captured proof (photos + the
// tech's spoken notes) and the proposed work, with per-line approve/decline. The whole
// point is trust — the customer sees the actual problem and hears the tech explain it
// before approving. Consent to the on-site capture is acknowledged here (privacy gate).

import * as React from 'react';
import type { ServiceJobDetail } from '@/lib/serviceJobs/types';
import { AboutThatEmbed } from '@/components/admin/templates/render-blocks/about-that';
import { HEAR_THIS_PAGE_EMBED_ID } from '@/lib/hearThisPage/config';

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// About That embed used to narrate the report (house narrator, short version). Reuses the
// platform house embed by default; override with a dedicated/per-shop SecondSet embed.
const NARRATION_EMBED_ID =
  process.env.NEXT_PUBLIC_SECONDSET_NARRATION_EMBED_ID || HEAR_THIS_PAGE_EMBED_ID;

export default function JobPortalClient({
  token,
  initialJob,
}: {
  token: string;
  initialJob: ServiceJobDetail;
}) {
  const [job, setJob] = React.useState<ServiceJobDetail>(initialJob);
  const [decisions, setDecisions] = React.useState<Record<string, boolean>>({});
  const [consent, setConsent] = React.useState<boolean>(!!initialJob.consent_captured_at);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [pageUrl, setPageUrl] = React.useState('');
  React.useEffect(() => {
    if (typeof window !== 'undefined') setPageUrl(window.location.origin + window.location.pathname);
  }, []);

  const photos = job.captures.filter((c) => c.kind === 'photo' && c.photo_url);
  const notes = job.captures.filter((c) => c.kind === 'note' && (c.transcript || c.audio_url || c.narration_url));
  const decided = job.status === 'approved' || job.status === 'declined';

  async function submit() {
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        consent,
        decisions: job.line_items
          .filter((li) => li.id in decisions)
          .map((li) => ({ lineItemId: li.id, approved: decisions[li.id] })),
      };
      const res = await fetch(`/api/service-jobs/portal/${token}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      if (data.job) setJob(data.job);
      setMsg('Thanks — your choices were sent to the shop.');
    } catch (e: any) {
      setMsg(e?.message || 'Could not submit.');
    } finally {
      setSaving(false);
    }
  }

  const hasContent = photos.length > 0 || notes.length > 0 || job.line_items.length > 0;

  return (
    <div className="mt-6 space-y-8">
      {/* Hear the whole report narrated (About That, short version) */}
      {hasContent && pageUrl && NARRATION_EMBED_ID ? (
        <section className="rounded-2xl border border-border bg-muted/20 p-4">
          <div className="mb-2 text-sm font-semibold">🔊 Hear this report</div>
          <AboutThatEmbed embedId={NARRATION_EMBED_ID} url={pageUrl} width="100%" kinds={['summary']} />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Narrated summary of what the tech found and what&apos;s proposed. (Narrator voice — the raw clips
            below are the tech&apos;s own.)
          </p>
        </section>
      ) : null}

      {/* Proof captured on the glasses */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground">What the tech saw</h2>
        {photos.length === 0 && notes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No photos or notes yet — check back shortly.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {photos.map((c) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={c.id} src={c.photo_url as string} alt="Captured by the technician" className="w-full rounded-xl border border-border" />
            ))}
            {notes.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="text-xs font-medium text-muted-foreground">🎙️ Tech&apos;s note</div>
                {c.transcript ? <p className="mt-1 text-sm">{c.transcript}</p> : null}
                {(c.narration_url || c.audio_url) ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio className="mt-2 w-full" controls preload="none" src={(c.narration_url || c.audio_url) as string} />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Proposed work — approve/decline */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground">Proposed work</h2>
        {job.line_items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No work proposed yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {job.line_items.map((li) => {
              const choice = li.status !== 'proposed' ? li.status : decisions[li.id] === true ? 'approved' : decisions[li.id] === false ? 'declined' : null;
              return (
                <li key={li.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{li.description}</div>
                    <div className="text-xs text-muted-foreground">{dollars(li.price_cents)}</div>
                  </div>
                  {decided || li.status !== 'proposed' ? (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${li.status === 'approved' ? 'bg-emerald-500/15 text-emerald-600' : li.status === 'declined' ? 'bg-red-500/15 text-red-600' : 'bg-muted text-muted-foreground'}`}>
                      {li.status}
                    </span>
                  ) : (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDecisions((d) => ({ ...d, [li.id]: true }))}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium ${choice === 'approved' ? 'bg-emerald-500 text-white' : 'border border-border hover:bg-muted'}`}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecisions((d) => ({ ...d, [li.id]: false }))}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium ${choice === 'declined' ? 'bg-red-500 text-white' : 'border border-border hover:bg-muted'}`}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!decided && job.line_items.length > 0 ? (
        <section className="space-y-3">
          {!initialJob.consent_captured_at ? (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              <span>I consent to the shop capturing photos and audio notes of my vehicle for this job, kept with my service record.</span>
            </label>
          ) : null}
          <button
            type="button"
            onClick={submit}
            disabled={saving || Object.keys(decisions).length === 0 || (!initialJob.consent_captured_at && !consent)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Sending…' : 'Send my decision'}
          </button>
          {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Status: <b>{job.status.replace('_', ' ')}</b>. {msg}</p>
      )}
    </div>
  );
}
