// test/stripComments.ts
//
// ⚠️ A SOURCE GUARD MUST READ CODE, NEVER PROSE. Shared because this exact mistake has now been
// made repeatedly, by different checks, on different days: a test greps a file for a forbidden
// string and **fails on the comment that explains why the string is forbidden.**
//
// Three instances in this repo inside one day (see the 2026-09-25 handoff), then two more the same
// afternoon while wiring the guest funnel:
//
//   • `merchantHomepage.test.ts` — the homepage's deletion note names "downline" and "recruit link"
//     precisely because those are the words that were removed.
//   • `guestFunnel.test.ts` — `app/api/guest/funnel/route.ts` asserts it accepts no email field, in
//     a comment containing the word "email".
//
// The pattern is structural, not careless: **the clearest possible comment about a banned token
// contains that token**, so the better the documentation, the more certainly the naive check
// fails. Writing the stripper once, in one place, is what stops each new guard rediscovering it.
//
// ⚠️ Whatever uses this must ALSO assert the stripped source is still substantial. A stripper that
// ate its input would make every downstream assertion pass against an empty string — silence that
// reads as success, which is the failure class the guards exist to catch in the first place.

/**
 * Remove JSX (`{/* … *\/}`), block (`/* … *\/`) and line (`// …`) comments from a TS/TSX source.
 *
 * Deliberately a regex rather than a parser: it runs in tests over files that already compile, and
 * the failure mode that matters (a comment surviving into the match) is one this handles. It is not
 * a lexer — a comment marker inside a string literal is stripped too. That direction is safe for a
 * forbidden-token check (it can only remove text, never invent a match), but do not reuse this to
 * transform source that will be executed.
 */
export function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}
