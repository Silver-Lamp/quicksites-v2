// lib/theme/fontPairings.ts
//
// Curated Canva-style font pairings (a distinctive display face for headings +
// a clean workhorse for body). A CuratedTheme references a pairing by id; the
// render layer resolves it to CSS vars (--font-heading / --font-body) and a
// Google Fonts stylesheet href loaded per-site in the site <head>.
//
// Loading strategy: render-time <link rel="stylesheet"> scoped to the site, so
// each site pulls only its own two families (display=swap + preconnect). See
// docs/THEME_SYSTEM_PLAN.md §2b.

export type FontRole = {
  /** Google Fonts family name, e.g. "Space Grotesk". */
  family: string;
  /** Full CSS font-family stack (family + fallbacks). */
  stack: string;
  /** Weights to request from Google Fonts. */
  weights: number[];
};

export type FontPairing = {
  id: string;
  name: string;
  mood: 'editorial' | 'modern' | 'friendly' | 'technical' | 'elegant' | 'bold';
  heading: FontRole;
  body: FontRole;
};

const INTER: FontRole = {
  family: 'Inter',
  stack: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  weights: [400, 500, 600],
};

export const FONT_PAIRINGS: Record<string, FontPairing> = {
  'oswald-inter': {
    id: 'oswald-inter',
    name: 'Oswald · Inter',
    mood: 'technical',
    heading: { family: 'Oswald', stack: '"Oswald", system-ui, sans-serif', weights: [500, 700] },
    body: INTER,
  },
  'archivo-inter': {
    id: 'archivo-inter',
    name: 'Archivo · Inter',
    mood: 'bold',
    heading: { family: 'Archivo', stack: '"Archivo", system-ui, sans-serif', weights: [600, 700] },
    body: INTER,
  },
  'dmserif-dmsans': {
    id: 'dmserif-dmsans',
    name: 'DM Serif Display · DM Sans',
    mood: 'elegant',
    heading: { family: 'DM Serif Display', stack: '"DM Serif Display", Georgia, serif', weights: [400] },
    body: { family: 'DM Sans', stack: '"DM Sans", system-ui, sans-serif', weights: [400, 500, 600] },
  },
  'fraunces-inter': {
    id: 'fraunces-inter',
    name: 'Fraunces · Inter',
    mood: 'editorial',
    heading: { family: 'Fraunces', stack: '"Fraunces", Georgia, "Times New Roman", serif', weights: [500, 600] },
    body: INTER,
  },
  'poppins-inter': {
    id: 'poppins-inter',
    name: 'Poppins · Inter',
    mood: 'friendly',
    heading: { family: 'Poppins', stack: '"Poppins", system-ui, sans-serif', weights: [600, 700] },
    body: INTER,
  },
  'sora-inter': {
    id: 'sora-inter',
    name: 'Sora · Inter',
    mood: 'modern',
    heading: { family: 'Sora', stack: '"Sora", system-ui, sans-serif', weights: [600, 700] },
    body: INTER,
  },
  'space-inter': {
    id: 'space-inter',
    name: 'Space Grotesk · Inter',
    mood: 'technical',
    heading: { family: 'Space Grotesk', stack: '"Space Grotesk", system-ui, sans-serif', weights: [500, 700] },
    body: INTER,
  },
  'lora-inter': {
    id: 'lora-inter',
    name: 'Lora · Inter',
    mood: 'elegant',
    heading: { family: 'Lora', stack: '"Lora", Georgia, serif', weights: [500, 600] },
    body: INTER,
  },
  'bricolage-inter': {
    id: 'bricolage-inter',
    name: 'Bricolage Grotesque · Inter',
    mood: 'modern',
    heading: { family: 'Bricolage Grotesque', stack: '"Bricolage Grotesque", system-ui, sans-serif', weights: [600, 700] },
    body: INTER,
  },
  'jetbrains-inter': {
    id: 'jetbrains-inter',
    name: 'JetBrains Mono · Inter',
    mood: 'technical',
    heading: { family: 'JetBrains Mono', stack: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace', weights: [600, 700] },
    body: INTER,
  },
  'playfair-source': {
    id: 'playfair-source',
    name: 'Playfair Display · Source Sans 3',
    mood: 'editorial',
    heading: { family: 'Playfair Display', stack: '"Playfair Display", Georgia, serif', weights: [600, 700] },
    body: { family: 'Source Sans 3', stack: '"Source Sans 3", system-ui, sans-serif', weights: [400, 600] },
  },
};

/** Safe lookup: returns the pairing or null for unknown ids. */
export function getFontPairing(id?: string | null): FontPairing | null {
  if (!id) return null;
  return FONT_PAIRINGS[id] ?? null;
}

/** One Google Fonts `family=` fragment, e.g. `Space+Grotesk:wght@500;700`. */
function familyParam(role: FontRole): string {
  const fam = role.family.trim().replace(/\s+/g, '+');
  const weights = [...new Set(role.weights)].sort((a, b) => a - b).join(';');
  return weights ? `${fam}:wght@${weights}` : fam;
}

/**
 * Build the Google Fonts CSS2 stylesheet URL for a pairing (heading + body,
 * deduped when they share a family). Returns null if the pairing is unknown.
 */
export function fontPairHref(id?: string | null): string | null {
  const pair = getFontPairing(id);
  if (!pair) return null;
  const families = [pair.heading];
  if (pair.body.family !== pair.heading.family) families.push(pair.body);
  const q = families.map((r) => `family=${familyParam(r)}`).join('&');
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}
