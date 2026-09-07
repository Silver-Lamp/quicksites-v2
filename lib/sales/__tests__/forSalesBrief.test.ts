// lib/sales/__tests__/forSalesBrief.test.ts
//
// Guards the REP BRIEF (app/for-sales/page.tsx). Its sibling lanes.test.ts guards the call sheet.
//
// ⚠️ Both failures below actually shipped on this page:
//   1. It said the domains "don't rank for anything" in one card and "several rank on page one"
//      three cards later. Each was true of a different population and a rep reading top to bottom
//      could not tell which — the page argued with itself in front of the person selling from it.
//   2. The proposed outreach line was "Get seen on page one when someone googles <trade> in
//      <city>" — a future promise, and the exact phrasing `no_ranking_promise` bans.
import { readFileSync } from 'fs';
import { join } from 'path';

const BRIEF = readFileSync(join(process.cwd(), 'app/for-sales/page.tsx'), 'utf8');

/**
 * Future-tense ranking claims. The tense is the whole difference.
 *
 * ⚠️ These started as five literal phrasings and the negative control below rejected them: it
 * planted "We will get you on page one, guaranteed" and NOTHING matched. A banned-phrase list is
 * the wrong shape for this — a promise is a grammatical form, not a fixed string, and someone will
 * always write a new sentence with the same meaning. So match the SHAPE: a future marker within a
 * short distance of a ranking word.
 */
const FUTURE = String.raw`(?:will|won't|'ll|\u2019ll|gonna|going to|guarantee\w*|promise\w*)`;
const RANKING = String.raw`(?:page\s*one|page\s*1|first\s+page|top\s+of\s+google|rank\w*)`;
const PROMISES = [
  new RegExp(`${FUTURE}[^.!?]{0,60}${RANKING}`, 'i'),
  new RegExp(`${RANKING}[^.!?]{0,40}${FUTURE}`, 'i'),
  /get\s+seen\s+on\s+page\s+one/i,
];

describe('the rep brief never puts a promise in a rep’s mouth', () => {
  it('contains no future-tense ranking claim, outside the parts that forbid them', () => {
    // ⚠️ The page is ALLOWED to quote a banned phrase while banning it — "Never promise a ranking"
    // and the never-say list are the honesty rules themselves. So a chunk whose promise is
    // preceded by a negation is a rule, not a claim.
    // The trade-off, stated rather than hidden: a genuine promise written into a sentence that
    // already contains "not" would slip through. That is narrow, and the alternative — no check —
    // is worse. The negative controls below keep the matcher honest either way.
    const NEGATED = /\b(never|not|no|don'?t|doesn'?t|cannot|can'?t|won'?t|avoid|refuse)\b/i;
    const chunks = BRIEF.split(/[.!?]\s|\n/);
    const offenders: string[] = [];
    for (const chunk of chunks) {
      for (const re of PROMISES) {
        const hit = chunk.match(re);
        if (!hit) continue;
        const before = chunk.slice(0, hit.index ?? 0);
        if (NEGATED.test(before)) continue; // "Never promise a ranking" — the rule, not a breach
        offenders.push(chunk.trim().slice(0, 120));
      }
    }
    expect(offenders).toEqual([]);
  });

  it.each([
    'We will get you on page one, guaranteed.',
    "This'll get you on page one.",
    "You'll rank for towing in Renton.",
    'Get seen on page one when someone googles towing in your city.',
    'I promise you page one within ninety days.',
    'We guarantee a first page ranking.',
  ])('would catch a promise — the matcher is not inert: %s', (planted) => {
    // The day's lesson, and it earned its keep here: the first version of PROMISES was a list of
    // literal phrasings and this control rejected it — "will get you on page one" matched none.
    expect(PROMISES.some((re) => re.test(planted))).toBe(true);
  });

  it('does not fire on the honest present-tense version', () => {
    // The whole point is that this sentence stays legal.
    const ok = "Search arab towing right now. That's us on page one today.";
    expect(PROMISES.some((re) => re.test(ok))).toBe(false);
  });
});

describe('the brief does not argue with itself about ranking', () => {
  it('never states flatly that the domains rank for nothing', () => {
    // The old sentence. It was false about the proven ones the same page later cites.
    expect(BRIEF).not.toMatch(/these domains don\W*t rank for anything/i);
  });

  it('names both populations, so a reader can tell which is which', () => {
    // Some inventory ranks today; most does not. The page has to say both, together.
    expect(BRIEF).toMatch(/already (hold|rank)/i);
    expect(BRIEF).toMatch(/(most of (the|these)|don\W*t rank yet|ranks for nothing yet)/i);
  });

  it('keeps the exact-match distinction, which is what makes the claim true', () => {
    // "Type it in" is true; "search the trade and you'll find us" is not. Losing this line is how
    // an honest page becomes an overstatement without anyone adding a false sentence.
    expect(BRIEF).toMatch(/exact-match|own exact-match name/i);
  });
});

describe('the map results are described as not ours to sell', () => {
  it('says a Business Profile belongs to a real business', () => {
    expect(BRIEF).toMatch(/Business Profile/i);
    expect(BRIEF).toMatch(/don\W*t make those|never will|belongs to a real business/i);
  });
});

describe('two products, and only one of them is the rep’s', () => {
  // ⚠️ We now build sites for businesses that have none. That product is self-serve BECAUSE a
  // commission on it cannot pay for the call that sold it. A rep brief that presents both as
  // sellable sends someone to spend an hour closing nine dollars a month.
  it('names the other product and says it is not a call', () => {
    expect(BRIEF).toMatch(/other product/i);
    expect(BRIEF).toMatch(/self-serve/i);
  });

  it('scopes the 50/50 to rentals rather than to "anything you bring on"', () => {
    // The old wording was literally true when there was one product and is too broad now.
    expect(BRIEF).not.toMatch(/50\/50 on anything you bring on/i);
    expect(BRIEF).toMatch(/50\/50 on every rental/i);
  });

  it('quotes no price for the self-serve tiers, because none has been paid', () => {
    // The business plan calls those numbers a proposal, not a rate. A rep page stating them as
    // prices would make a guess look settled — and a rep would then quote it on a call.
    const card = BRIEF.slice(BRIEF.indexOf('other product'), BRIEF.indexOf('other product') + 2500);
    expect(card).not.toMatch(/\$\s?\d/);
    expect(card).toMatch(/proposal rather than a rate/i);
  });

  it('gives the rep something to do with a prospect who wants only a website', () => {
    // The point of naming it: a "no" on the rental stops being a dead lead, so nobody invents a
    // cheaper offer on the spot to rescue one.
    expect(BRIEF).toMatch(/not a dead lead|claim link and move on/i);
  });
});
