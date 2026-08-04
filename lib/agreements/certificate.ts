// lib/agreements/certificate.ts
//
// The signed copy, as ONE self-contained HTML file that both parties keep.
//
// ⚠️ THE SIGNER MUST NOT HAVE TO TRUST US TO KEEP THEIR OWN CONTRACT. This is the same rule the
// Verbatim export is built on (lib/verbatim/exportProfile.ts): hand over an artefact, not a
// dependency. If our database vanished tomorrow, the agreement should still exist — in their
// inbox, complete, with the document text and the fingerprint that proves it is the text they
// signed. A signing product whose evidence only lives on the vendor's server is asking the weaker
// party to trust the stronger one about what was agreed.
//
// So: no script, no stylesheet, no font, no image, no analytics, no link back to us. It opens
// from a USB stick in ten years and prints on one sheet.
//
// ⚠️ AND IT STATES EXACTLY WHAT WE RECORDED — NOTHING MORE. No "certified", no "verified
// identity", no "legally binding", no seal graphic. What makes this defensible is the audit
// trail being accurate and complete, and the fastest way to destroy that is to dress it up.
// The block of text under "How this was signed" is the honest claim, and it is deliberately
// unglamorous.

import { shortHash } from './document';

export type CertificateInput = {
  title: string;
  /** The exact text that was signed — the same string the hash was taken over. */
  bodyText: string;
  documentSha256: string;
  partyName: string;
  partyEmail?: string | null;
  /** Who we sent the link to. */
  signerName: string;
  signerEmail: string;
  /** What they typed, verbatim — a different claim from who we addressed. */
  typedName: string;
  signedAtIso: string;
  signerIp?: string | null;
  userAgent?: string | null;
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** ISO → "4 August 2026 at 16:31 UTC". Explicitly UTC: a timestamp with no zone is not evidence. */
export function formatSignedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} at ${hh}:${mm} UTC`;
}

/**
 * Render the document as paragraphs.
 *
 * ⚠️ DELIBERATELY NOT A MARKDOWN RENDERER. The hash is taken over the source text, so anything
 * that reflows or reinterprets it introduces a gap between what was hashed and what is displayed —
 * and that gap is precisely where a signing product can lie without anyone noticing. Blank-line
 * paragraph breaks and escaping, nothing else. If richer documents are ever wanted, hash the
 * RENDERED output, not the source, and change HASH_ALGO.
 */
function renderBody(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export function agreementCertificateHtml(c: CertificateInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)} — signed</title>
<style>
  :root { color-scheme: only light; }
  * { box-sizing: border-box; }
  body { margin: 0 auto; padding: 3rem 1.5rem; max-width: 44rem; background: #fff; color: #1a1a1a;
         font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  h1 { font-size: 1.6rem; margin: 0 0 .25rem; letter-spacing: -.01em; }
  h2 { font-size: .78rem; text-transform: uppercase; letter-spacing: .09em; color: #666;
       margin: 2.5rem 0 .75rem; border-bottom: 1px solid #e5e5e5; padding-bottom: .3rem; }
  h3 { font-size: 1rem; margin: 1.6rem 0 .3rem; }
  p { margin: 0 0 .75rem; }
  .doc p { white-space: normal; }
  .record { border: 1px solid #ddd; border-radius: 6px; padding: 1rem 1.25rem; }
  .record dl { display: grid; grid-template-columns: max-content 1fr; gap: .35rem 1.25rem; margin: 0; }
  .record dt { color: #666; font-size: .875rem; }
  .record dd { margin: 0; font-size: .875rem; word-break: break-word; }
  .hash { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .8rem; }
  .note { margin-top: 1rem; font-size: .8rem; color: #555; }
  @media print { body { padding: 0; max-width: none; } h2 { break-after: avoid; } }
</style>
</head>
<body>

<h1>${esc(c.title)}</h1>
<p class="hash">Document fingerprint ${esc(shortHash(c.documentSha256))}</p>

<h2>The agreement</h2>
<div class="doc">
${renderBody(c.bodyText)}
</div>

<h2>How this was signed</h2>
<div class="record">
  <dl>
    <dt>Signed by</dt><dd>${esc(c.typedName)} (typed)</dd>
    <dt>Sent to</dt><dd>${esc(c.signerName)} &lt;${esc(c.signerEmail)}&gt;</dd>
    <dt>Presented by</dt><dd>${esc(c.partyName)}${
      c.partyEmail ? ` &lt;${esc(c.partyEmail)}&gt;` : ''
    }</dd>
    <dt>When</dt><dd>${esc(formatSignedAt(c.signedAtIso))}</dd>
    ${c.signerIp ? `<dt>From</dt><dd>${esc(c.signerIp)}</dd>` : ''}
    ${c.userAgent ? `<dt>Browser</dt><dd>${esc(c.userAgent)}</dd>` : ''}
    <dt>Fingerprint</dt><dd class="hash">${esc(c.documentSha256)}</dd>
  </dl>
  <!-- ⚠️ The honest paragraph. It says what we know and, just as importantly, what we do not.
       Any future edit that makes this sound more authoritative is a downgrade. -->
  <p class="note">
    The person at the address above opened a private link sent to that address, read the text
    shown here, confirmed they agreed to sign electronically, and typed their name. The
    fingerprint is a SHA-256 of the exact text they were shown — recompute it against the text
    above and it will match, or the document has changed since.
    <br><br>
    This record is not identity verification and not notarisation. It evidences possession of
    that email address at that moment, and what was on screen.
  </p>
</div>

</body>
</html>
`;
}
