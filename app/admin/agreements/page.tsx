// app/admin/agreements/page.tsx
//
// The agreements ledger: every document we have asked someone to sign, and every set of terms a
// visitor has accepted.
//
// ⚠️ THE TWO ARE LISTED SEPARATELY AND MUST STAY THAT WAY. A signature addressed one named person
// through their inbox; an acceptance is a self-reported name from whoever was at a keyboard. One
// combined table would let the signing surface's weight bleed onto records that never had it —
// the distinction is the whole product (crosstalk/contracts/agreements-record.md §1).
//
// ⚠️ AND IT SHOWS WHETHER ANYONE WAS TOLD. A signature with no notification is the failure this
// page exists to make visible: the record looks complete, and two people are sitting there
// assuming they have a copy of something nobody sent them.
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { listAgreements, listAcceptances } from '@/lib/agreements/ledger';
import { shortHash } from '@/lib/agreements/document';
import NotifyButton from './notify-button';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function Pill({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'mute'; children: React.ReactNode }) {
  const cls = {
    good: 'border-emerald-500/40 bg-emerald-500/10',
    warn: 'border-amber-500/40 bg-amber-500/10',
    bad: 'border-red-500/40 bg-red-500/10',
    mute: 'border-border bg-muted/30',
  }[tone];
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs text-foreground ${cls}`}>
      {children}
    </span>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

export default async function AgreementsLedgerPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-muted-foreground">Forbidden.</div>;

  const [agreements, acceptances] = await Promise.all([listAgreements(), listAcceptances()]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Agreements</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every document sent for signature, and every set of terms accepted on a public page.{' '}
        <span className="text-foreground">Integrity is recomputed on each load</span> — the
        fingerprint is checked against the stored text right now, not read from a flag.
      </p>

      {/* ── Signatures ─────────────────────────────────────────────── */}
      <h2 className="mt-10 text-lg font-semibold text-foreground">Signed agreements</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Addressed to one named person by email. Signing evidences possession of that inbox — it is
        not identity verification.
      </p>

      {agreements.length === 0 && (
        <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Nothing yet.
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {agreements.map((a) => (
          <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-card-foreground">{a.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {a.signerName} &lt;{a.signerEmail}&gt; · presented by {a.partyName}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {a.voidedAt ? (
                  <Pill tone="mute">voided</Pill>
                ) : a.signature ? (
                  <Pill tone="good">signed {when(a.signature.signedAt)}</Pill>
                ) : (
                  <Pill tone="warn">awaiting signature</Pill>
                )}

                {/* The integrity verdict, with `unverifiable` kept distinct from `altered`. */}
                {a.integrity === 'match' && <Pill tone="good">text verified</Pill>}
                {a.integrity === 'altered' && <Pill tone="bad">⚠ text no longer matches</Pill>}
                {a.integrity === 'unverifiable' && <Pill tone="warn">no fingerprint</Pill>}
              </div>
            </div>

            {a.signature && (
              <div className="mt-3 grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
                <div className="text-muted-foreground">
                  Typed name{' '}
                  <span className="text-foreground">{a.signature.typedName}</span>
                  {a.signature.signerIp && (
                    <> · from <span className="text-foreground">{a.signature.signerIp}</span></>
                  )}
                  <br />
                  Fingerprint{' '}
                  <span className="font-mono text-xs text-foreground">
                    {shortHash(a.signature.documentSha256)}
                  </span>
                </div>

                <div className="sm:text-right">
                  {/* Three states, and the third is the point: never-ran is not the same as failed. */}
                  {a.signature.notifiedAt ? (
                    <Pill tone="good">both parties emailed {when(a.signature.notifiedAt)}</Pill>
                  ) : a.signature.notifyError ? (
                    <span className="inline-flex flex-col items-start gap-1 sm:items-end">
                      <Pill tone="bad">⚠ nobody was emailed</Pill>
                      <span className="text-xs text-muted-foreground">{a.signature.notifyError}</span>
                    </span>
                  ) : (
                    <Pill tone="warn">notification never ran</Pill>
                  )}
                  <div className="mt-2">
                    <NotifyButton
                      agreementId={a.id}
                      label={a.signature.notifiedAt ? 'Send again' : 'Send notices'}
                    />
                  </div>
                </div>
              </div>
            )}

            {a.voidedReason && (
              <p className="mt-2 text-sm text-muted-foreground">Voided: {a.voidedReason}</p>
            )}
          </li>
        ))}
      </ul>

      {/* ── Acceptances ────────────────────────────────────────────── */}
      <h2 className="mt-12 text-lg font-semibold text-foreground">Accepted terms</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        From <code className="text-xs">agreement</code> blocks on public pages.{' '}
        <span className="text-foreground">These are not signatures</span> — nobody was addressed,
        so the name is self-reported and there is no identity evidence.
      </p>

      {acceptances.length === 0 && (
        <p className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Nothing yet.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {acceptances.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm"
          >
            <div>
              <span className="font-medium text-card-foreground">
                {r.documentTitle || 'Untitled terms'}
              </span>
              <span className="text-muted-foreground">
                {' '}· {r.typedName}
                {r.email ? ` <${r.email}>` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {shortHash(r.documentSha256)}
              </span>
              {r.integrity === 'match' ? (
                <Pill tone="good">verified</Pill>
              ) : r.integrity === 'altered' ? (
                <Pill tone="bad">⚠ altered</Pill>
              ) : (
                <Pill tone="warn">no fingerprint</Pill>
              )}
              <span className="text-xs text-muted-foreground">{when(r.acceptedAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
