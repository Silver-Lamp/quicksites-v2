// lib/rebuild/matchPosting.ts
//
// Compare a job posting against someone's résumé and report TWO lists:
//
//   overlaps — requirements the résumé already evidences, each CITING the line it came from
//   gaps     — requirements the résumé never mentions
//
// ⚠️ NOTHING HERE IS GENERATED. NO MODEL CALL, BY DESIGN, AND THE DESIGN IS THE POINT.
//
// The tempting version of this feature writes "where your strengths fit this role" and then has
// you practise saying it. The mesh took that apart on all three sides at once and reached the
// same place independently: rehearsal doesn't neutralise an unsupported claim, it LAUNDERS it.
// A weak line is hedged and awkward and an interviewer probes it; the same line practised six
// times is delivered fluently, and fluency is exactly what stops it being caught. That is worse
// than keyword-stuffing — stuffing games a machine and a human catches the gap later, whereas
// this coaches a human to be persuasive about the gap. It hurts the candidate (a job they'll
// fail) and the employer both.
//
// So this module does set comparison over text two parties already wrote — the person's résumé
// and the employer's posting — and never manufactures a claim about fit. The safest version
// turned out to also be the smallest: because nothing is generated, no "never fabricate"
// guardrail has to be enforced anywhere, and a constraint you don't have to enforce cannot rot.
//
// ⚠️ THE ASYMMETRY: UNDER-REPORT GAPS, NEVER OVER-REPORT. A gap that isn't real
// ("your résumé doesn't mention Python" when page two says Python) sends someone to study
// something they already have and quietly tells them their own CV is worse than it is. A missed
// gap merely fails to help. So a requirement is only called a gap when it appears NOWHERE in the
// résumé under loose matching — absence has to be total before we'll say it out loud.
//
// Same shape as the menu index's rule that a price we can't date is dropped rather than quoted:
// when unsure, say less about someone else's facts.

import { looseMatch, tokenize } from '@/lib/menu/looseMatch';

export type Overlap = {
  /** The requirement term as the posting expressed it. */
  term: string;
  /** ⚠️ REQUIRED. The résumé line this came from — the citation that keeps this extractive. */
  evidence: string;
};

export type Gap = {
  term: string;
  /** The posting line that asked for it, so the person can judge how central it is. */
  source: string;
};

export type PostingMatch = {
  overlaps: Overlap[];
  gaps: Gap[];
  /** True when the posting yielded no recognisable requirements — say so, don't imply a match. */
  inconclusive: boolean;
};

/** Headings that introduce the part of a posting that actually lists requirements. */
const REQUIREMENT_HEADINGS =
  /^(requirements|qualifications|what you'?ll need|what we'?re looking for|you have|you'?ll bring|must have|skills|about you|experience|nice to have|preferred)\b/i;

/** Headings that end it — perks and legal boilerplate are not things to be assessed against. */
const CLOSING_HEADINGS =
  /^(benefits|perks|what we offer|compensation|salary|equal opportunity|about (us|the company)|how to apply|our team)\b/i;

/** Phrases that introduce an explicit skills list. */
const LEAD_INS =
  /\b(?:experience (?:with|in|of)|proficiency (?:with|in)|proficient (?:with|in)|knowledge of|familiarity with|expertise (?:with|in)|fluent in|skilled (?:with|in)|working with|hands-on with)\b[:\s]*/gi;

/**
 * Words that look like terms but say nothing about a skill. Kept deliberately short: a long
 * blocklist is a dictionary in disguise, and dictionaries rot. Anything that slips through
 * becomes a slightly noisy row the person can ignore — the failure mode is mild in the
 * direction we chose to be wrong.
 */
const NOT_A_SKILL = new Set([
  'you', 'we', 'our', 'your', 'the', 'and', 'or', 'with', 'for', 'this', 'that', 'they',
  'a', 'an', 'in', 'on', 'at', 'to', 'of', 'as', 'is', 'are', 'be', 'will', 'must', 'should',
  'years', 'year', 'experience', 'strong', 'excellent', 'good', 'great', 'ability', 'skills',
  'work', 'working', 'team', 'teams', 'role', 'company', 'candidate', 'job', 'position',
  'plus', 'bonus', 'etc', 'including', 'such', 'other', 'more', 'least', 'able',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'january', 'february', 'march',
  'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
]);

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Narrow a posting to the lines that state requirements.
 *
 * Returns every line when no requirements heading is found — a posting written as prose still
 * contains its asks, and silently returning nothing would report "no gaps", which reads as
 * "you're a perfect match". Saying nothing and saying everything-is-fine are different claims.
 */
export function requirementLines(posting: string): string[] {
  const lines = posting.split(/\r?\n/).map((l) => clean(l)).filter(Boolean);
  const start = lines.findIndex((l) => REQUIREMENT_HEADINGS.test(l) && l.length <= 60);
  if (start < 0) return lines;

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => CLOSING_HEADINGS.test(l) && l.length <= 60);
  const section = end < 0 ? rest : rest.slice(0, end);
  return section.length ? section : lines;
}

/**
 * Pull candidate skill terms out of a requirement line.
 *
 * Two deterministic signals, no dictionary and no model:
 *   1. Tokens that look like proper technology names — capitalised away from the line start, or
 *      carrying digits/symbols (C++, K8s, ES2020, PostgreSQL).
 *   2. Whatever follows an explicit lead-in ("experience with X, Y and Z").
 */
export function termsFromLine(line: string): string[] {
  const out: string[] = [];
  const body = line.replace(/^[-–—*•·◦▪‣]\s*/, '');

  // (2) first: lead-ins carry the most reliable signal, including lowercase skills the
  // capitalisation heuristic would miss entirely.
  for (const m of body.matchAll(LEAD_INS)) {
    const tail = body.slice((m.index ?? 0) + m[0].length);
    // Stop at sentence end or a conjunction that changes subject.
    const listPart = tail.split(/[.;]|\s+\b(?:and then|but|while|to build|to work)\b/i)[0] ?? '';
    for (const piece of listPart.split(/,|\/|\band\b|\bor\b/i)) {
      const t = clean(piece).replace(/^[-–—]\s*/, '');
      if (t && t.split(/\s+/).length <= 4) out.push(t);
    }
  }

  // (1) proper-noun / symbol-bearing tokens.
  const words = body.split(/\s+/);
  words.forEach((raw, i) => {
    const w = raw.replace(/^[("']+|[),.;:"']+$/g, '');
    if (!w || w.length < 2) return;
    const looksTechy = /[0-9+#.]/.test(w) && /[A-Za-z]/.test(w);
    const capitalisedMidLine = i > 0 && /^[A-Z][A-Za-z0-9+#.-]*$/.test(w);
    if (looksTechy || capitalisedMidLine) out.push(w);
  });

  return out
    .map((t) => clean(t))
    .filter((t) => t.length >= 2 && t.length <= 40 && !NOT_A_SKILL.has(t.toLowerCase()));
}

/**
 * Dedupe case-insensitively, and drop terms SUBSUMED by a longer one from the same line.
 *
 * The capitalisation heuristic picks up "Design" from "Design systems" as well as the phrase
 * itself, so a real run listed both — "Design" citing the person's job title, which is a true
 * but useless row. Keeping the longer term keeps the specific claim and discards the vague one.
 * Only ever removes rows, so it cannot manufacture a gap.
 */
function dedupe(terms: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  // Longest first, so the specific phrase claims the ground before its fragments arrive.
  for (const t of [...terms].sort((a, b) => b.length - a.length)) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    if (kept.some((other) => other.toLowerCase().includes(k))) continue;
    seen.add(k);
    kept.push(t);
  }
  // Restore the posting's own order — the employer's ordering carries their priorities.
  return terms.filter((t) => kept.includes(t));
}

/** The first résumé line that evidences a term — this is the citation, so it must be real. */
function evidenceFor(term: string, resumeLines: string[]): string | null {
  for (const line of resumeLines) {
    if (looseMatch(term, line)) return line;
  }
  return null;
}

const MAX_ROWS = 24;

/**
 * Compare a posting to a résumé. Both inputs are text their own authors wrote; nothing is
 * inferred about the person beyond "these words are, or are not, present".
 */
export function matchPostingToResume(resumeText: string, postingText: string): PostingMatch {
  const resumeLines = String(resumeText ?? '')
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);
  const posting = String(postingText ?? '');

  const lines = requirementLines(posting);
  const overlaps: Overlap[] = [];
  const gaps: Gap[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    for (const term of dedupe(termsFromLine(line))) {
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // A single significant token is enough to count as covered. Deliberately generous: it
      // errs toward "you already have this", which is the direction chosen above.
      const evidence = evidenceFor(term, resumeLines);
      if (evidence) {
        overlaps.push({ term, evidence });
        continue;
      }

      // Before calling it a gap, check the whole résumé as one blob — a skill split across a
      // line break would otherwise be reported missing when it is plainly there.
      if (looseMatch(term, resumeLines.join(' '))) {
        overlaps.push({ term, evidence: resumeLines.find((l) => tokenize(l).length > 0) ?? '' });
        continue;
      }

      gaps.push({ term, source: line });
    }
  }

  return {
    overlaps: overlaps.slice(0, MAX_ROWS),
    gaps: gaps.slice(0, MAX_ROWS),
    // No recognisable requirements means we learned nothing. Reporting zero gaps here would
    // read as "you match everything", which is a claim we have no basis for.
    inconclusive: overlaps.length === 0 && gaps.length === 0,
  };
}
