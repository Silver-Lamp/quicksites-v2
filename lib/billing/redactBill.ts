// lib/billing/redactBill.ts
//
// Find the identifying parts of a cloud bill so they can be struck out BEFORE the text is sent
// anywhere.
//
// ⚠️ WHY THIS RUNS BEFORE THE UPLOAD, NOT AFTER IT.
//
// The obvious offer is "upload your bill and we'll strip the identifying bits for you." That
// sounds generous and it is strictly worse for the person uploading, because to strip it we must
// first RECEIVE it. The promise is about what we do with their account numbers after we already
// have them — which is a policy, and a policy is a thing you're asked to trust.
//
// Doing it in the browser first turns the same promise into a fact: the identified version never
// leaves their machine, so there is no retention window, no breach surface, and nothing to
// take on faith. Same argument as the résumé PDF reader (lib/rebuild/pdfText.ts) — don't hold
// what you don't need — and it matters more here, not less, because this text goes on to an LLM
// AND to a human third party (the site owner sees the enquiry).
//
// ⚠️ THIS IS AN ASSISTANT, NOT A GUARANTEE, AND THE UI MUST SAY SO. A regex sweep over an
// arbitrary invoice cannot promise it caught everything: account IDs vary by vendor, a company
// name can be any string, and a bill can carry a project codename that identifies its owner to
// anyone in the industry. So this HIGHLIGHTS candidates for a human to confirm — it never
// silently "cleans" a document and declares it safe. Telling someone their bill is anonymised
// when it isn't is worse than not offering the feature, because they'd have checked it themselves.
//
// Detection errs toward OVER-flagging: a false positive costs one click to un-strike, a false
// negative ships an account number to a stranger.

export type RedactionKind =
  | 'account'
  | 'email'
  | 'phone'
  | 'card'
  | 'arn'
  | 'ip'
  | 'url'
  | 'address';

export type Finding = {
  kind: RedactionKind;
  /** The exact text matched, so the UI can show what it would strike. */
  text: string;
  start: number;
  end: number;
};

/** Human labels for the review UI — plain words, not regex names. */
export const KIND_LABEL: Record<RedactionKind, string> = {
  account: 'account or invoice number',
  email: 'email address',
  phone: 'phone number',
  card: 'card or payment number',
  arn: 'cloud resource identifier',
  ip: 'IP address',
  url: 'web address',
  address: 'postal address',
};

/**
 * Ordered because earlier patterns win an overlap — a 16-digit card should not also be reported
 * as a generic account number.
 */
const PATTERNS: Array<{ kind: RedactionKind; re: RegExp }> = [
  { kind: 'email', re: /[\w.+-]+@[\w-]+\.[\w.]{2,}/g },
  // Card-ish runs of 13–16 digits, optionally spaced or hyphenated.
  { kind: 'card', re: /\b(?:\d[ -]?){13,16}\b/g },
  // AWS ARNs and long vendor resource ids.
  { kind: 'arn', re: /\barn:[a-z0-9-]*:[a-z0-9-]+:[^\s,;]*/gi },
  { kind: 'ip', re: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
  // "Account ID: 1234-5678-9012", "Invoice #INV-00123", "Customer No. 88213"
  {
    kind: 'account',
    re: /\b(?:account|acct|customer|invoice|payer|billing)\s*(?:id|no\.?|number|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{4,})/gi,
  },
  // ⚠️ The country code must be OPTIONAL, not "one or two digits". The first version required
  // leading digits, so "(714) 555-0134" — the way a phone number is actually written on an
  // American invoice — matched only from "555" onward and left the area code in the text. A
  // half-redacted phone number is not a partial success; it is a phone number.
  { kind: 'phone', re: /(?:\+\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g },
  { kind: 'url', re: /\bhttps?:\/\/[^\s,;]+/gi },
  // A US-ish street line. Deliberately loose — an over-flag costs one click.
  {
    kind: 'address',
    re: /\b\d{1,6}\s+[A-Z][A-Za-z.]*(?:\s+[A-Z][A-Za-z.]*){0,4}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court|Suite|Ste|Fl|Floor)\b\.?/g,
  },
];

const overlaps = (a: Finding, b: Finding) => a.start < b.end && b.start < a.end;

/**
 * Every identifying candidate in the text, in document order, without overlaps.
 *
 * Pure and synchronous so the review UI can re-run it on every keystroke — a person editing their
 * bill should see the highlights move as they type, not after a round-trip.
 */
export function findIdentifiers(text: string): Finding[] {
  const out: Finding[] = [];
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const f: Finding = { kind, text: m[0], start, end: start + m[0].length };
      // Earlier patterns win: a card number must not be re-reported as an account number.
      if (out.some((existing) => overlaps(existing, f))) continue;
      out.push(f);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** What a struck finding is replaced with — readable, so the LLM still knows a value was there. */
export function placeholderFor(kind: RedactionKind): string {
  return `[${KIND_LABEL[kind]} removed]`;
}

/**
 * Apply a set of findings to the text.
 *
 * `keep` lists findings the person chose NOT to strike (a false positive they un-ticked), by
 * start offset — because the person, not the regex, decides what is identifying about their own
 * document.
 */
export function redact(text: string, findings: Finding[], keep: Set<number> = new Set()): string {
  const active = findings.filter((f) => !keep.has(f.start)).sort((a, b) => b.start - a.start);
  let out = text;
  for (const f of active) {
    out = out.slice(0, f.start) + placeholderFor(f.kind) + out.slice(f.end);
  }
  return out;
}

/** A count per kind, for a one-line summary above the review pane. */
export function summarise(findings: Finding[]): Array<{ kind: RedactionKind; label: string; count: number }> {
  const counts = new Map<RedactionKind, number>();
  for (const f of findings) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, label: KIND_LABEL[kind], count }))
    .sort((a, b) => b.count - a.count);
}
