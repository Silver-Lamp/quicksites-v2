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

/**
 * ⚠️ NO LETTERING — AND THIS NEEDS ITS OWN POSITIVE-FORM INSTRUCTION, NOT A NEGATIVE.
 *
 * `NO_PEOPLE_NEGATIVES` has said "no text, no watermarks, no logos" since it existed, and the
 * model ignores it often enough to matter: a hero generated for a real paving company came back
 * with "VB FERAONT SMLPEE" stencilled on the tanker, and an earlier one rendered the trade word
 * as "Seacoating". Misspelled pseudo-lettering on a business's own advertising is worse than no
 * image at all — on a paving flyer it reads as illiteracy, and the business did not write it.
 *
 * Image models follow positive instructions ("surfaces are clean and unmarked") far more reliably
 * than prohibitions ("no text"), because a negative still puts the concept in the prompt. So this
 * is phrased as a description of the scene, and it is stated FIRST rather than appended to a list.
 *
 * ⚠️ Do not delete the "no text" clause from NO_PEOPLE_NEGATIVES to avoid duplication — belt and
 * braces is the point, and generateHero.test.ts pins that wording.
 */
export const NO_TEXT_INSTRUCTION =
  'Every surface is clean and unmarked: vehicles, equipment, signs, walls and pavement carry no lettering, numbers, logos, branding or written characters of any kind.';

/** People + lettering, joined — the constraint most prompts want. */
export const NO_PEOPLE_NO_TEXT_CLAUSE =
  `${NO_TEXT_INSTRUCTION} ${NO_PEOPLE_INSTRUCTION} Strictly: ${NO_PEOPLE_NEGATIVES}.`;
