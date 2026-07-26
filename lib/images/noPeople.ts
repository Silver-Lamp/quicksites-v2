// lib/images/noPeople.ts
//
// Rule 9 of the mesh painterly-backdrop standard (crosstalk/contracts/painterly-backdrop.md,
// adopted network-wide 2026-07-26): NO generated people, and nothing implying a specific
// named individual. Every QuickSites image-generation prompt folds these in.
//
// Why this is load-bearing here and not just a style preference: our strongest image path
// is the listing-import pipeline, which auto-builds sites for REAL, NAMED businesses. A
// generated photo of smiling staff on a real restaurant's page asserts employees and
// customers who do not exist — the same class of dishonesty as labeling a narrator clip
// "in the owner's voice" when the render reported otherwise (see the audio-honesty
// standard's rule 2). Decoration must not make a factual claim about a real business.
//
// Keep these as the single source: a second hand-written "no people" string in a new
// prompt is how the rule quietly rots.

/** Positive-form instruction — what the image SHOULD be, in place of people. */
export const NO_PEOPLE_INSTRUCTION =
  'No people, faces, or figures of any kind; focus on the space, the work, the results, and the equipment.';

/** Negative-form list, baked into the prompt (the OpenAI images API has no negative param).
 *  Keep "no text, no watermarks, no logos" plural + last — it preserves the wording the
 *  hero prompts carried before this constant existed, which generateHero.test.ts pins. */
export const NO_PEOPLE_NEGATIVES =
  'no people, no faces, no portraits, no hands, no silhouettes, no crowds, no text, no watermarks, no logos';

/** Both, joined — for prompts that take one flat constraint string. */
export const NO_PEOPLE_CLAUSE = `${NO_PEOPLE_INSTRUCTION} Strictly: ${NO_PEOPLE_NEGATIVES}.`;
