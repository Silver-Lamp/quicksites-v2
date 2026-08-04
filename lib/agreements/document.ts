// lib/agreements/document.ts
//
// The fingerprint of what the signer was shown.
//
// ⚠️ THIS IS THE WHOLE FEATURE. A signature record that says "Eiji signed on 4 August" is a claim
// ABOUT A DOCUMENT, and it is worth exactly nothing unless you can say which document. Store a
// hash of the exact text presented and the claim becomes checkable by anyone, forever, without
// trusting us — including by the signer, against the copy in their own inbox.
//
// ⚠️ CANONICALISATION MUST BE BORING AND MUST NEVER CHANGE MEANING. It exists so that
// cosmetically-identical text hashes identically — a trailing space or a CRLF from a Windows
// paste should not make a signature fail to verify. It must NOT do anything that could alter what
// the document says: no markdown rendering, no smart quotes, no unicode folding beyond NFC, no
// case changes. Every transform here is reversible in meaning, and that is the bar for adding one.
//
// If this function's behaviour ever changes, previously stored hashes stop matching. That is not
// a bug to paper over with a fallback — it is a version boundary, and it needs a new `algo` value
// so an old signature verifies with the old rule rather than silently reporting "altered".

import crypto from 'crypto';

/** Bump when canonicalisation changes; stored alongside the hash so old records still verify. */
export const HASH_ALGO = 'sha256/v1';

/**
 * Normalise text for hashing.
 *
 * - NFC — the same characters, one representation (an "é" typed two ways is one character).
 * - CRLF/CR → LF — a Windows paste must not be a different document.
 * - trailing whitespace per line stripped, and a single trailing newline — invisible edits
 *   from an editor should not invalidate a signature.
 */
export function canonicalize(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '\n');
}

/** Hex SHA-256 of the canonicalised document. */
export function documentHash(text: string): string {
  return crypto.createHash('sha256').update(canonicalize(text), 'utf8').digest('hex');
}

/**
 * Does this text still match what was signed?
 *
 * ⚠️ Returns a verdict, never a boolean-with-a-shrug. A caller that cannot tell "matches" from
 * "we have no hash to compare" would report an unverifiable record as intact, which is the
 * silence-looks-like-success failure aimed at the one thing here that must not lie.
 */
export type HashVerdict = 'match' | 'altered' | 'unverifiable';

export function verifyDocument(text: string, storedHash: string | null | undefined): HashVerdict {
  if (!storedHash) return 'unverifiable';
  return documentHash(text) === storedHash ? 'match' : 'altered';
}

/** Short, human-comparable form for print — full hash still stored and shown in the certificate. */
export function shortHash(hash: string): string {
  return hash.slice(0, 8).toUpperCase();
}
