// lib/industries/search.ts
//
// Searching the industry list, and guessing one from a business name.
//
// ⚠️ THE PICKER WAS A RAW <select> OVER ~60 OPTIONS, which is a scrolling exercise, not a choice.
// Worse, it sat directly beneath a business name the person had ALREADY TYPED — "Joe's Ship
// Repair" — and asked them to go and find their own trade in an alphabetical list we could have
// searched for them.
//
// Two separate jobs, deliberately separate functions:
//   • searchIndustries  — what matches what they are typing right now
//   • suggestFromBusinessName — what we would guess before they type anything
//
// ⚠️ A GUESS IS OFFERED, NEVER APPLIED. The suggestion is pre-highlighted and always overridable,
// and when nothing matches well it says so instead of picking the nearest thing. An industry
// silently chosen for someone shapes their whole scaffold — services, theme, copy — so a wrong
// confident guess costs far more than no guess.

import { INDUSTRIES, type IndustryKey } from '@/lib/industries';

export type IndustryMatch = {
  key: IndustryKey;
  label: string;
  /** Higher is better. Only meaningful for ordering within one result set. */
  score: number;
  /** Which word actually matched — shown to the person so a surprising hit explains itself. */
  via: string;
};

/**
 * Words people actually type that are not in any label.
 *
 * ⚠️ This is the difference between a search box and a filter. "AC" is not in "HVAC / Heating &
 * Air"; "boat" is in no label at all; someone with a power washer types "power wash" and the
 * label says "Pressure Washing". A plain substring filter returns nothing for every one of those
 * and the person concludes we do not support their trade.
 */
export const INDUSTRY_ALIASES: Partial<Record<IndustryKey, string[]>> = {
  hvac: ['ac', 'air conditioning', 'heating', 'furnace', 'cooling', 'heat pump'],
  plumbing: ['plumber', 'drain', 'pipes', 'water heater', 'leak'],
  electrical: ['electrician', 'wiring', 'panel', 'lighting install'],
  towing: ['tow truck', 'wrecker', 'roadside', 'recovery', 'impound'],
  auto_repair: ['mechanic', 'garage', 'car repair', 'brakes', 'transmission', 'oil change'],
  windshield_repair: ['auto glass', 'chip repair', 'rock chip'],
  pressure_washing: ['power wash', 'power washing', 'soft wash', 'driveway cleaning'],
  window_washing: ['window cleaner', 'glass cleaning'],
  roof_cleaning: ['moss removal', 'roof wash'],
  landscaping: ['lawn care', 'mowing', 'yard', 'gardening', 'sod'],
  pest_control: ['exterminator', 'bugs', 'rodent', 'termite'],
  carpet_cleaning: ['rug cleaning', 'upholstery'],
  moving: ['movers', 'removals', 'hauling'],
  junk_removal: ['rubbish', 'debris', 'clear out'],
  painting: ['painter', 'interior painting', 'exterior painting'],
  general_contractor: ['remodel', 'renovation', 'builder', 'construction'],
  deck_builder: ['decking', 'patio', 'pergola'],
  fencing: ['fence', 'gate install'],
  concrete: ['driveway', 'slab', 'foundation', 'masonry'],
  photography: ['photographer', 'photos', 'headshots', 'wedding photos'],
  legal: ['lawyer', 'attorney', 'law firm', 'solicitor'],
  medical_dental: ['dentist', 'doctor', 'clinic', 'orthodontist'],
  faith: ['church', 'ministry', 'parish', 'congregation', 'worship'],
  author: ['writer', 'books', 'novelist', 'self published'],
  personal: ['about me', 'resume', 'cv', 'portfolio of me'],
  custom_apparel: ['t shirts', 'tshirts', 'screen printing', 'embroidery'],
  retail_thrift: ['thrift', 'consignment', 'secondhand', 'resale'],
  antiques_vintage: ['antique', 'vintage', 'estate sale'],
  fitness: ['gym', 'personal trainer', 'yoga', 'pilates', 'crossfit'],
  restaurant: ['cafe', 'diner', 'takeaway', 'food', 'menu', 'bistro', 'pizzeria'],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Rank industries against what the person is typing.
 *
 * Scoring, strongest first: exact label, label starts-with, label contains, alias starts-with,
 * alias contains, then every query WORD appearing somewhere ("repair auto" finds Auto Repair).
 */
export function searchIndustries(query: string, limit = 8): IndustryMatch[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(' ').filter(Boolean);
  const out: IndustryMatch[] = [];

  for (const { key, label } of INDUSTRIES) {
    const nLabel = norm(label);
    const aliases = (INDUSTRY_ALIASES[key] ?? []).map(norm);
    let score = 0;
    let via = label;

    // ⚠️ MAX, NOT else-if. The aliases used to sit in an `else`, so a label that merely CONTAINED
    // the query short-circuited them: typing "ac" scored 60 on "General Contr(ac)tor" and never
    // reached HVAC's exact alias `ac` (90). The weaker, accidental match won on alphabetical
    // order. Every rule scores independently and the best one wins.
    if (nLabel === q) score = 100;
    else if (nLabel.startsWith(q)) score = 80;
    // ⚠️ A bare substring is only trustworthy for a real word. Two letters land inside dozens of
    // labels by accident ("ac" in contractor, "ar" in carpentry) and drown the deliberate aliases.
    else if (q.length >= 3 && nLabel.includes(q)) score = 60;

    for (const a of aliases) {
      if (a === q) { if (90 > score) { score = 90; via = a; } }
      else if (a.startsWith(q)) { if (70 > score) { score = 70; via = a; } }
      else if (q.length >= 3 && (a.includes(q) || q.includes(a))) { if (50 > score) { score = 50; via = a; } }
    }

    // Multi-word fallback: every word has to land somewhere, so "auto glass repair" still finds
    // Windshield Repair without a dedicated alias for that exact phrase.
    if (score === 0 && words.length > 1) {
      const hay = [nLabel, ...aliases].join(' ');
      if (words.every((w) => hay.includes(w))) score = 40;
    }

    if (score > 0) out.push({ key, label, score, via });
  }

  // ⚠️ De-duplicate by KEY. The list carries several labels per key on purpose ("Window Washing"
  // and "Window Cleaning"), and showing both as separate results makes the picker look broken.
  const best = new Map<IndustryKey, IndustryMatch>();
  for (const m of out) {
    const prev = best.get(m.key);
    if (!prev || m.score > prev.score) best.set(m.key, m);
  }

  return [...best.values()]
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** How sure we are, in words rather than a number the UI would have to interpret. */
export type SuggestionConfidence = 'strong' | 'weak' | 'none';

export type IndustrySuggestion = {
  match: IndustryMatch | null;
  confidence: SuggestionConfidence;
  /** The words we matched on, for "because you wrote …". Null when we did not match. */
  because: string | null;
};

/**
 * ⚠️ Words that appear in MANY trades and identify none of them on their own.
 *
 * "Joe's Ship Repair" is the case: we have no marine trade, and the lone word "repair" matches
 * both Auto Repair and Windshield Repair at equal score — so it resolved alphabetically to an
 * auto shop. Even offered weakly that is a bad suggestion a hurried person may accept, and the
 * scaffold it builds (services, theme, copy) is a car garage. A generic word alone suggests
 * nothing; paired with something specific ("auto repair", "roof cleaning") it is fine, which is
 * why this only blocks the single-word case.
 */
const GENERIC_TRADE_WORDS = new Set([
  'repair', 'repairs', 'cleaning', 'clean', 'care', 'design', 'supply', 'supplies',
  'center', 'centre', 'contracting', 'maintenance', 'installation', 'install',
]);

/** Words in a business name that describe nobody's trade. */
const STOP = new Set([
  'the', 'and', 'of', 'a', 'an', '&', 'llc', 'inc', 'co', 'company', 'ltd', 'corp',
  'services', 'service', 'solutions', 'group', 'shop', 'store', 'studio', 'works',
  's', 'my', 'your', 'best', 'pro', 'professional', 'quality', 'local',
]);

/**
 * Guess an industry from the business name the person already typed.
 *
 * ⚠️ RETURNS `none` RATHER THAN A NEAREST GUESS. "Joe's Ship Repair" has no marine trade in our
 * list, and the word "repair" alone would happily drag it to Auto Repair — confidently wrong, and
 * wrong in a way that shapes the whole scaffold (services, theme, copy) before they notice. When
 * nothing matches well the honest answer is to leave the picker empty and let the free-text
 * "Other" field carry their own words.
 */
export function suggestFromBusinessName(name: string): IndustrySuggestion {
  const words = norm(name).split(' ').filter((w) => w && !STOP.has(w) && w.length > 1);
  if (words.length === 0) return { match: null, confidence: 'none', because: null };

  // ⚠️ SCAN EVERY SPAN BEFORE DECIDING — do NOT return on the first hit.
  //
  // The first version returned as soon as anything scored ≥50, and longer spans are tried first,
  // so "Rivera's Plumbing & Drain" matched the two-word phrase "plumbing drain" at 50 (weak, via
  // the alias `drain`) and never reached the single word "plumbing", which is an exact label at
  // 100. Three of five real names came back `weak` for that reason — the answer was right and the
  // confidence was wrong, which matters because the UI only pre-selects on `strong`.
  //
  // Longer phrases still win ties, so "auto glass" beats "auto".
  let bestStrong: { m: IndustryMatch; phrase: string; span: number } | null = null;
  let bestWeak: { m: IndustryMatch; phrase: string; span: number } | null = null;

  for (let span = Math.min(3, words.length); span >= 1; span--) {
    for (let i = 0; i + span <= words.length; i++) {
      const phrase = words.slice(i, i + span).join(' ');
      // A lone generic word identifies no trade — see GENERIC_TRADE_WORDS.
      if (span === 1 && GENERIC_TRADE_WORDS.has(phrase)) continue;
      const [top] = searchIndustries(phrase, 1);
      if (!top) continue;
      // ⚠️ A single generic word is not enough on its own. "repair", "cleaning" and "design"
      // appear in many trades, and accepting one of them is how "Ship Repair" becomes an auto shop.
      const strong = top.score >= 70 && (span > 1 || top.score >= 80);
      const cand = { m: top, phrase, span };
      if (strong) {
        if (!bestStrong || span > bestStrong.span || top.score > bestStrong.m.score) bestStrong = cand;
      } else if (top.score >= 50) {
        if (!bestWeak || span > bestWeak.span || top.score > bestWeak.m.score) bestWeak = cand;
      }
    }
  }

  if (bestStrong) return { match: bestStrong.m, confidence: 'strong', because: bestStrong.phrase };
  if (bestWeak) return { match: bestWeak.m, confidence: 'weak', because: bestWeak.phrase };
  return { match: null, confidence: 'none', because: null };
}
