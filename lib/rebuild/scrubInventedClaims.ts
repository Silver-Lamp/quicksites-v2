// lib/rebuild/scrubInventedClaims.ts
//
// Strip operational claims from AI-written copy for a business we have never spoken to.
//
// ⚠️ WHAT THIS IS FOR. A listing import knows a business's name, address, phone and Google
// category. Nothing else. Asked for "conversion-oriented copy" from that, a model writes what
// conversion copy says — "We're here for you 24/7", "We aim to reach you within 30 minutes",
// "fully licensed and insured", "free estimates" — about a real, named third party whose hours,
// response time, insurance and pricing we do not know. Real examples, from real generated sites:
//
//   "We aim to reach you within 30 minutes of your call."      (All-In Towing and Recovery)
//   "...reliable towing services in Good Hope, AL. We're here for you 24/7!"
//
// "Licensed and insured" is the worst of them: a regulatory claim about someone else's company.
// This is the invented-menu class (CLAUDE.md §5b, #738) with liability attached, and the harm
// lands on the business, not on us.
//
// ⚠️ THE PROMPT IS NOT THE GUARD. Both prompts now forbid this, but an instruction is a request.
// This runs on the output, deterministically, so a model that ignores the instruction — or a future
// model, or a changed prompt — cannot put the claim on a page.

/** Claims about facts only the owner knows. Each must be about the BUSINESS, not a question. */
const CLAIM_PATTERNS: Array<{ id: string; re: RegExp }> = [
  // Availability: "24/7", "around the clock", "any time day or night".
  { id: 'availability', re: /\b(24\s*\/\s*7|24-7|around the clock|day or night|anytime,? day or night)\b/i },
  // Response time: "within 30 minutes", "in under an hour", "fast 20-minute response".
  { id: 'response-time', re: /\b(within|in under|in less than|under)\s+\d+\s*(-|\s)?\s*(min|minute|hour)/i },
  { id: 'response-time', re: /\b\d+\s*-?\s*(minute|hour)\s+(response|arrival|eta)\b/i },
  // Licensing / insurance / bonding — regulatory claims about a third party.
  { id: 'licensing', re: /\b(fully\s+)?(licensed|insured|bonded)\b(?!\s*\?)/i },
  // Price promises.
  { id: 'pricing', re: /\b(free|no[- ]obligation)\s+(quote|estimate|inspection|consultation)\b/i },
  { id: 'pricing', re: /\b(lowest|best|beat any)\s+price\b/i },
  // Guarantees and satisfaction promises.
  { id: 'guarantee', re: /\b(guarantee[ds]?|warrantied|100%\s+satisfaction)\b/i },
  // Tenure — "over 20 years of experience" about a business we just found on a map.
  { id: 'tenure', re: /\b(over|more than)\s+\d+\s+years\b/i },
];

export type ScrubResult = { text: string; hits: string[] };

/** Split into sentences, keeping their terminators, so removing one leaves the rest readable. */
function sentences(text: string): string[] {
  return String(text ?? '').match(/[^.!?]+[.!?]*/g) ?? [];
}

/**
 * Remove any SENTENCE that makes an operational claim. Sentence-level rather than phrase-level
 * because #857 learned this the hard way: a blanket phrase replacement produced
 * "ready around the clock where we can to help you" and rewrote an FAQ *question* into nonsense.
 * Ungrammatical honesty is not honesty — it reads as a broken site.
 */
export function scrubText(text: string | null | undefined): ScrubResult {
  const hits: string[] = [];
  const kept = sentences(text ?? '').filter((s) => {
    const hit = CLAIM_PATTERNS.find((p) => p.re.test(s));
    if (hit) hits.push(hit.id);
    return !hit;
  });
  return { text: kept.join('').replace(/\s+/g, ' ').trim(), hits };
}

export type Faq = { q?: string; a?: string };

/**
 * Drop FAQs whose ANSWER makes a claim. The question is never the problem — "Are you licensed and
 * insured?" is a fine thing to be asked, and industryCopy already answers it honestly ("Ask us and
 * we'll confirm..."). It is the answer that must not assert.
 */
export function scrubFaqs(faqs: Faq[] | null | undefined): { faqs: Faq[]; hits: string[] } {
  const hits: string[] = [];
  const kept = (faqs ?? []).filter((f) => {
    const hit = CLAIM_PATTERNS.find((p) => p.re.test(String(f?.a ?? '')));
    if (hit) hits.push(hit.id);
    return !hit;
  });
  return { faqs: kept, hits };
}

/** True when this copy asserts something only the owner could know. Used by tests and guards. */
export function makesOperationalClaim(text: string | null | undefined): boolean {
  return CLAIM_PATTERNS.some((p) => p.re.test(String(text ?? '')));
}
