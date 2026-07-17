// lib/safety/prohibitedContent.ts
//
// First-line screening for illegal / prohibited items + services listed for sale or
// hire on the platform (catalog_items, gigs, menus). PURE + testable. This is a
// deterministic HEURISTIC gate, not a legal determination or a substitute for human
// review — it catches high-confidence prohibited categories and lets everything else
// through.
//
// Design bias: MINIMIZE FALSE POSITIVES on legitimate local businesses. Our customers
// are plumbers, restaurants, salons, deck builders. Many words are dual-use ("knife"
// = kitchen supply, "gun" = caulk gun / gun cleaning, "bar" = restaurant). So patterns
// are written to fire only on high-confidence illegal phrasing (a controlled drug by
// name, "for sale" + a weapon class, counterfeit/replica of a brand, explicit sexual
// services), and we prefer to WARN/ASK over hard-block on ambiguous matches.
//
// Returns the first category hit. Callers decide enforcement (block vs. flag-for-review).

export type ProhibitedCategory =
  | 'controlled_substances'
  | 'prescription_drugs'
  | 'weapons'
  | 'explosives'
  | 'counterfeit'
  | 'sexual_services'
  | 'stolen_goods'
  | 'fraud_identity'
  | 'endangered_wildlife'
  | 'human_remains';

export type ScreenResult = {
  ok: boolean;
  category?: ProhibitedCategory;
  /** The specific phrase that matched — for the operator-facing reason, never shown raw to buyers. */
  matched?: string;
  /** Severity: 'block' = refuse; 'review' = allow but flag (dual-use / lower confidence). */
  severity?: 'block' | 'review';
};

type Rule = { category: ProhibitedCategory; severity: 'block' | 'review'; patterns: RegExp[] };

// Word-boundary helper — avoids matching inside legit words (e.g. "coke" in "cokehead"
// is fine to miss; "Coca-Cola" must not trip "cocaine").
const w = (s: string) => new RegExp(`(^|[^a-z0-9])${s}([^a-z0-9]|$)`, 'i');

const RULES: Rule[] = [
  {
    category: 'controlled_substances',
    severity: 'block',
    patterns: [
      // Unambiguous drug names (rarely legit dual-use).
      w('cocaine'), w('crack cocaine'), w('heroin'), w('fentanyl'), w('methamphetamine'),
      w('crystal meth'), w('mdma'), w('ecstasy pills'), w('psilocybin'), w('magic mushrooms'),
      w('carfentanil'), w('black tar heroin'),
      // Dual-use terms (meth-lab-cleanup, ketamine-clinic, PCP-pipe, LSD-the-band) require
      // an explicit sale/supply context so legit remediation/medical/retail don't trip.
      /\b(buy|sell|selling|for sale|score|gram|8 ?ball|eighth|ounce|plug|dealer)\b.{0,25}\b(meth|ketamine|pcp|ghb|lsd|acid tabs?)\b/i,
      /\b(meth|ketamine|pcp|ghb|lsd|acid tabs?)\b.{0,25}\b(for sale|buy|gram|8 ?ball|discreet ship|plug|dealer)/i,
    ],
  },
  {
    category: 'prescription_drugs',
    severity: 'block',
    patterns: [
      // Rx drugs offered for sale without a prescription.
      /\b(oxycodone|oxycontin|hydrocodone|percocet|vicodin|xanax|alprazolam|adderall|ritalin|valium|klonopin|ambien|tramadol|codeine|promethazine|suboxone)\b.{0,40}\b(for sale|no (rx|prescription)|without (a )?(rx|prescription)|buy|cheap|discreet)/i,
      /\b(buy|order|get)\b.{0,20}\b(oxycodone|oxycontin|xanax|adderall|percocet|vicodin|valium)\b.{0,20}\b(online|no rx|no prescription)/i,
    ],
  },
  {
    category: 'weapons',
    severity: 'block',
    patterns: [
      w('ghost gun'), w('untraceable firearm'), w('auto sear'), w('machine gun'),
      w('full auto'), w('suppressor'), /\bsilencer\b.{0,30}\b(for sale|buy)/i,
      /\b(unregistered|no (background|serial))\b.{0,20}\b(gun|firearm|pistol|rifle|handgun)/i,
      /\b(buy|sell|for sale)\b.{0,20}\b(grenade|c4|c-4|dynamite|explosive|landmine)/i,
    ],
  },
  {
    category: 'explosives',
    severity: 'block',
    patterns: [w('pipe bomb'), w('ied'), /\b(homemade|diy)\b.{0,15}\bexplosive/i, w('detonator')],
  },
  {
    category: 'counterfeit',
    severity: 'block',
    patterns: [
      w('counterfeit'), /\b(replica|fake|knock ?off|1:1)\b.{0,25}\b(rolex|gucci|louis vuitton|chanel|prada|nike|yeezy|designer|handbag|watch|sneaker)/i,
      /\b(fake|forged|novelty)\b.{0,15}\b(id|passport|driver'?s? licen[sc]e|diploma|currency|bills?)/i,
      w('counterfeit money'),
    ],
  },
  {
    category: 'fraud_identity',
    severity: 'block',
    patterns: [
      w('stolen credit card'), w('cc dumps'), w('fullz'), w('cvv shop'),
      /\b(hack|hacking|hacker)\b.{0,20}\b(for hire|service|account|password|social media|instagram|facebook|email)/i,
      w('carding'), /\b(clone|cloned)\b.{0,15}\bcard/i, w('ssn for sale'),
    ],
  },
  {
    category: 'sexual_services',
    severity: 'block',
    patterns: [
      // Explicit paid-sex phrasing only — NOT "massage", "escort" alone (legit uses exist).
      /\b(escort|companionship)\b.{0,20}\b(sex|sexual|full service|gfe|incall|outcall)/i,
      w('prostitution'), w('sex work for hire'), /\bpaid\b.{0,10}\bsex\b/i,
      /\b(sell|selling|buy)\b.{0,10}\bnudes\b/i,
    ],
  },
  {
    category: 'stolen_goods',
    severity: 'review', // dual-use ("liquidation", "no questions asked" can be legit resale)
    patterns: [/\bstolen\b.{0,15}\b(goods|merchandise|electronics|catalytic converter)/i, /\bno questions asked\b/i],
  },
  {
    category: 'endangered_wildlife',
    severity: 'block',
    patterns: [w('ivory tusk'), w('elephant ivory'), w('rhino horn'), w('pangolin'), w('tiger pelt'), w('shark fin')],
  },
  {
    category: 'human_remains',
    severity: 'block',
    patterns: [/\b(human)\b.{0,10}\b(remains|bones|skull|body parts)\b.{0,15}\b(for sale|buy)/i, w('human organs')],
  },
];

/**
 * Screen a listing's text (title + description + any extra fields) for prohibited
 * content. Concatenates the inputs and returns the first hit. `ok:true` when nothing
 * fired. Callers block on `severity:'block'` and may flag-for-review on `'review'`.
 */
export function screenListing(input: {
  title?: string | null;
  description?: string | null;
  extra?: Array<string | null | undefined>;
}): ScreenResult {
  const text = [input.title, input.description, ...(input.extra ?? [])]
    .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    .join(' \n ')
    .slice(0, 8000); // cap: don't scan unbounded input
  if (!text.trim()) return { ok: true };

  for (const rule of RULES) {
    for (const rx of rule.patterns) {
      const m = text.match(rx);
      if (m) {
        return { ok: false, category: rule.category, matched: m[0].trim().slice(0, 60), severity: rule.severity };
      }
    }
  }
  return { ok: true };
}

/** A buyer/owner-safe message for a blocked listing (never echoes the matched term). */
export function prohibitedMessage(category: ProhibitedCategory): string {
  const label: Record<ProhibitedCategory, string> = {
    controlled_substances: 'controlled substances or illegal drugs',
    prescription_drugs: 'prescription medication',
    weapons: 'weapons or firearms of this kind',
    explosives: 'explosives',
    counterfeit: 'counterfeit or replica branded goods',
    sexual_services: 'adult or sexual services',
    stolen_goods: 'stolen goods',
    fraud_identity: 'fraud, hacking, or identity documents',
    endangered_wildlife: 'protected or endangered wildlife products',
    human_remains: 'human remains or organs',
  };
  return `This listing appears to involve ${label[category]}, which can't be sold or advertised on the platform. If this is a mistake, edit the wording or contact support.`;
}
