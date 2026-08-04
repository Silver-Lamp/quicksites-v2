'use client';

// The interactive half of the signing page.
//
// ⚠️ THREE THINGS ARE STATUTORY, NOT UI GARNISH. Under ESIGN/UETA a signature needs intent to
// sign, consent to transact electronically, and association with the record. So: the button says
// "Sign", not "Continue"; the consent checkbox is required and worded plainly rather than buried
// in fine print; and the fingerprint of the document is on screen next to the button. All three
// are re-checked server-side — a UI-only check means the elements are simply absent for anyone
// who posts directly, which is exactly the record that would be challenged.
//
// ⚠️ AND IT NEVER OVERSTATES WHAT THIS IS. No "certified", no seal, no "legally binding". The
// copy says what we record and what we don't. A signing page that dresses itself up is doing the
// same thing as a narrator billed as the owner's voice.
import * as React from 'react';

type Agreement = {
  title: string;
  bodyMd: string;
  partyName: string;
  partyEmail: string | null;
  signerName: string;
  signerEmail: string;
};

/**
 * ⚠️ NOT A MARKDOWN RENDERER, DELIBERATELY. The fingerprint is taken over the source text, so
 * anything that reflows or reinterprets it opens a gap between what was hashed and what was read —
 * and that gap is exactly where a signing product can mislead without anyone noticing. Paragraph
 * breaks and line breaks, nothing else. React escapes the text for us.
 */
function DocumentBody({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="mb-3 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
          {para}
        </p>
      ))}
    </>
  );
}

export default function SignClient({
  token,
  agreement,
  documentSha256,
  alreadySigned,
}: {
  token: string;
  agreement: Agreement;
  documentSha256: string;
  alreadySigned: { typedName: string; signedAt: string } | null;
}) {
  const [typedName, setTypedName] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [signed, setSigned] = React.useState<{ signedAt: string } | null>(
    alreadySigned ? { signedAt: alreadySigned.signedAt } : null,
  );

  const downloadUrl = `/api/agreements/sign?token=${encodeURIComponent(token)}`;

  const submit = async () => {
    if (busy || !typedName.trim() || !consent) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/agreements/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, typedName, consent }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) setSigned({ signedAt: json.signedAt });
      else setError(json?.error ?? 'Something went wrong. Nothing was recorded.');
    } catch {
      setError('Something went wrong. Nothing was recorded — please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{agreement.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Presented by {agreement.partyName} for {agreement.signerName} ({agreement.signerEmail}).
        </p>
      </header>

      <article className="mt-8 rounded-2xl border border-border bg-card p-6">
        <DocumentBody text={agreement.bodyMd} />
      </article>

      {signed ? (
        <div className="mt-8 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6">
          <h2 className="text-lg font-semibold text-foreground">Signed. Thank you.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {alreadySigned
              ? `This was signed by ${alreadySigned.typedName}.`
              : 'A copy has been recorded.'}{' '}
            Keep your own copy — it works on its own, without us.
          </p>
          {/* ⚠️ The download is offered FIRST and permanently, not as an afterthought. Someone
              who has to ask the other party for a copy of what they signed is in a worse
              position than someone holding the file. */}
          <a
            href={downloadUrl}
            className="mt-4 inline-block rounded-xl bg-sky-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-sky-300"
          >
            Download the signed copy
          </a>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-card-foreground">Sign</h2>

          <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="typed-name">
            Type your full name
          </label>
          <input
            id="typed-name"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={agreement.signerName}
            autoComplete="name"
            className="mt-1.5 w-full rounded-xl border border-border bg-background p-3 text-base text-foreground placeholder:text-muted-foreground/60"
          />

          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>
              I agree to sign this electronically, and that typing my name above is my signature.
            </span>
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={busy || !typedName.trim() || !consent}
            className="mt-5 rounded-xl bg-sky-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-sky-300 disabled:opacity-40"
          >
            {busy ? 'Signing…' : 'Sign'}
          </button>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          {/* The honest paragraph — what is recorded, and what this is not. Same wording as the
              certificate, because the person should not learn the limits only afterwards. */}
          <div className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
            <p>
              When you sign, we record the name you typed, the time, your IP address and browser,
              and a fingerprint of the exact text above — so it can be shown later that this is
              what you read.
            </p>
            <p className="mt-2">
              This is not identity verification or notarisation. It evidences that whoever opened
              the private link sent to {agreement.signerEmail} agreed to this text.
            </p>
            <p className="mt-2 font-mono text-[11px] break-all">
              Fingerprint {documentSha256}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
