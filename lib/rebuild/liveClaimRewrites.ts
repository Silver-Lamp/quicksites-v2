// lib/rebuild/liveClaimRewrites.ts
//
// The operational claims that survived #857 and #906 on our LIVE sites, and the honest wording
// each one becomes. Curated by hand, one entry per real string read from the database, because the
// two categories left over are exactly the ones a filter cannot handle:
//
//   - blog / long-form prose, where a claim sits inside markup and sentence surgery breaks the
//     page, and where the regex has FALSE POSITIVES ("Battery Age Over 3 Years" is about a battery,
//     "day or night" is advice to a driver) that only a reader can tell from a claim;
//   - service names and headings ("24/7 Emergency Towing"), which want RENAMING — deleting the
//     string leaves a nameless service.
//
// Every `to` is checked by test to make no claim of its own; every `from` is checked to be a claim
// (or the placeholder below), so this map can only ever narrow what a page asserts. The script that
// applies it (scripts/rename-live-claims.mjs) walks the WHOLE template tree — the same content lives
// in html / text / value copies (CLAUDE.md §8) — and reports any entry that matched nothing, since a
// rewrite that finds no target is the silent-success failure this repo keeps re-learning.

export type Rewrite = { from: string; to: string; why: string };

/** The scaffold's "Why choose us" column, before and after. The BEFORE string still exists on live sites. */
export const SCAFFOLD_HIGHLIGHTS_BEFORE =
  '<h3>Why choose us</h3><ul><li>Licensed &amp; insured</li><li>Fast, friendly service</li><li>Satisfaction guaranteed</li></ul>';
export const SCAFFOLD_HIGHLIGHTS_HTML =
  '<h3>Why choose us</h3><ul><li>Fast, friendly service</li><li>Straight answers before work starts</li><li>Easy to reach — call or message</li></ul>';

/**
 * Exact-substring rewrites, applied to any string that contains `from`. Phrase-level deletion is
 * safe HERE because each entry was read in context: "here to help you 24/7." → "here to help you."
 * reads as a sentence. #857's garbage ("ready around the clock where we can to help you") came from
 * REPLACING a phrase with another phrase blind; these delete a qualifier or reword a whole sentence.
 */
export const REWRITES: Rewrite[] = [
  // ── Scaffold column (31 sites, incl. every starter-* a duplicate copies from) ──
  { from: SCAFFOLD_HIGHLIGHTS_BEFORE, to: SCAFFOLD_HIGHLIGHTS_HTML, why: 'licensing + guarantee bullets on the split-layout scaffold' },

  // ── Blog / long-form prose (graftontowing, spanawaytowing, florencetow, cullmantow, southhilltowing) ──
  { from: 'our local experts are here to help you 24/7.', to: 'our local experts are here to help you.', why: 'availability' },
  { from: '24/7 Emergency Assistance', to: 'Emergency Assistance', why: 'availability — a heading and towing-starter’s subheadline' },
  { from: 'for 24/7 towing and roadside assistance', to: 'for towing and roadside assistance', why: 'availability' },
  { from: '24/7 roadside battery jump-starts', to: 'Roadside battery jump-starts', why: 'availability — a list item' },
  { from: 'our team is ready 24/7 to get you moving again', to: 'our team is ready to get you moving again', why: 'availability' },
  // ⚠️ The first apply missed these two: on spanawaytowing and cullmantow the phrase sits inside a
  // <strong>, so "for 24/7 towing…" and "…ready 24/7 to get…" never occur as one substring. The
  // re-audit caught it (20 strings on 2 sites). Shorter targets that stop at the tag boundary.
  { from: '24/7 towing and roadside assistance', to: 'towing and roadside assistance', why: 'availability — inside <strong> on spanawaytowing' },
  { from: 'our team is ready 24/7', to: 'our team is ready', why: 'availability — inside <strong> on cullmantow' },
  {
    from: 'Licensed tow truck operators have the right equipment and training',
    to: 'Professional tow truck operators have the right equipment and training',
    why: 'reads as a licensing claim about this company even though it is about the trade',
  },
  {
    from: 'Our team is dedicated to providing prompt service and typically responds to towing requests within 30 minutes, ensuring you’re back on the road as soon as possible.',
    to: 'Our team is dedicated to prompt service — call and we’ll give you an honest ETA for your address.',
    why: 'response-time commitment inside an HTML FAQ',
  },

  // ── Service names / descriptions / subheadline / about (demo_seed sites) ──
  { from: 'Immediate assistance for urgent plumbing issues, 24/7.', to: 'Help with urgent plumbing issues — call for availability.', why: 'availability in a service description' },
  {
    from: "Our 24/7 emergency repair service ensures you're never left without heating or cooling.",
    to: 'Emergency repair when your heating or cooling fails — call for availability.',
    why: 'availability in a service description',
  },
  { from: '24/7 Emergency Towing', to: 'Emergency Towing', why: 'availability in a service NAME — rename, never delete' },
  {
    from: "We're available around the clock to tow your vehicle any time you need us.",
    to: 'Emergency towing when you need it — call for availability.',
    why: 'availability in a service description',
  },
  {
    from: 'Serving the Eugene community with pride, we guarantee satisfaction in every wash.',
    to: 'Serving the Eugene community with pride.',
    why: 'guarantee in meta.about',
  },
];

/**
 * Editor instruction text that leaked onto public pages. Not a claim — nothing is asserted — but
 * "Share your story and what sets you apart here." on a page we mail to a business as *their
 * website* reads as unfinished, and the card says it is ready. Seen on Osborne's Towing the day
 * the first claim card was rendered; 10 published sites and 14 drafts carried it. Removed, never
 * replaced: the sentence before it already reads as a whole.
 */
export const PLACEHOLDER_REWRITES: Rewrite[] = [
  { from: ' Share your story and what sets you apart here.', to: '', why: 'editor instruction leaked onto a public page' },
  { from: 'Share your story and what sets you apart here.', to: '', why: 'editor instruction leaked onto a public page (no leading space)' },
];

/**
 * A literal template placeholder shipped inside blog posts on three live custom domains. Filled from
 * the site's own name — and ONLY for slugs listed here. The script refuses to fill it anywhere else:
 * guessing a business's name is a worse bug than leaving the placeholder.
 */
export const PLACEHOLDER = '[Your Company Name]';
export const PLACEHOLDER_NAMES: Record<string, string> = {
  graftontowing: 'Grafton Towing',
  spanawaytowing: 'Spanaway Towing',
  florencetow: 'Florence Towing',
};

/**
 * Strings the claim regex flags that are NOT claims about the business. Left in place on purpose;
 * the audit lists them under their own heading with the reason, so the real-claim count is honest
 * without hiding what was excused.
 */
export const READER_ADVICE: Array<{ text: string; why: string }> = [
  { text: 'Battery Age Over 3 Years', why: 'the age of a car battery, not tenure' },
  { text: 'Turn them on immediately — day or night — to reduce your risk of being hit.', why: 'hazard-light advice to the driver' },
  { text: 'Always ensure that the plumbing company you choose is licensed and insured.', why: 'advice to the reader about choosing a plumber' },
];

export function isReaderAdvice(segment: string): boolean {
  return READER_ADVICE.some((r) => segment.includes(r.text));
}
