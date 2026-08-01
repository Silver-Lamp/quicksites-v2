/**
 * @jest-environment node
 */
// The matcher's whole value is that it says less than it could. These tests hold the two
// properties that make it safe to point at a real person's career:
//
//   1. Every overlap CITES a résumé line. No citation, no claim.
//   2. Gaps are UNDER-reported. A gap that isn't real sends someone to study something they
//      already have and tells them their own CV is worse than it is; a missed gap merely fails
//      to help. When unsure, we say nothing.
import { matchPostingToResume, requirementLines, termsFromLine } from '../matchPosting';

const RESUME = `Dana Okafor — Staff Engineer
dana@example.com

Summary
Eleven years across payments and developer platforms.

Skills
Backend: TypeScript · PostgreSQL · Go
Payments: Stripe · ledgers · reconciliation

Experience
Northwind Payments — Led the ledger rewrite. Ran the service on Docker in production.
`;

const POSTING = `Senior Backend Engineer
Acme Corp · Remote

About the company
We are a fast growing team.

Requirements
- 5+ years of experience with TypeScript and Go
- Strong PostgreSQL knowledge
- Experience with Kubernetes and Terraform
- Familiarity with Stripe billing

Benefits
- Unlimited PTO
- Kubernetes training budget
`;

describe('requirementLines narrows to what the posting actually asks for', () => {
  const lines = requirementLines(POSTING);

  it('starts at the requirements heading', () => {
    expect(lines.join(' ')).toContain('TypeScript and Go');
    expect(lines.join(' ')).not.toContain('fast growing team');
  });

  it('stops at the benefits heading', () => {
    // "Kubernetes training budget" is a perk, not a requirement. Counting it would produce a
    // gap for something the employer is OFFERING to teach.
    expect(lines.join(' ')).not.toContain('training budget');
    expect(lines.join(' ')).not.toContain('Unlimited PTO');
  });

  it('falls back to the whole posting when there is no requirements heading', () => {
    // Returning nothing would yield zero gaps, which reads as "you match everything" — a
    // different claim from "we could not tell".
    const prose = 'We need someone who has worked with Rust and gRPC before.';
    expect(requirementLines(prose).length).toBeGreaterThan(0);
  });
});

describe('termsFromLine extracts skills without a dictionary', () => {
  it('picks up capitalised technology names', () => {
    expect(termsFromLine('- Strong PostgreSQL knowledge')).toContain('PostgreSQL');
  });

  it('picks up names carrying digits or symbols', () => {
    const t = termsFromLine('- Solid C++ and ES2020 background');
    expect(t).toEqual(expect.arrayContaining(['C++', 'ES2020']));
  });

  it('reads an explicit lead-in list, including lowercase skills', () => {
    const t = termsFromLine('- Experience with kubernetes, terraform and helm');
    expect(t.map((s) => s.toLowerCase())).toEqual(expect.arrayContaining(['kubernetes', 'terraform', 'helm']));
  });

  it('drops filler that looks like a term but says nothing', () => {
    const t = termsFromLine('- Strong experience working with a great Team');
    expect(t.map((s) => s.toLowerCase())).not.toContain('team');
    expect(t.map((s) => s.toLowerCase())).not.toContain('experience');
  });
});

describe('matchPostingToResume', () => {
  const { overlaps, gaps, inconclusive } = matchPostingToResume(RESUME, POSTING);
  const gapTerms = gaps.map((g) => g.term.toLowerCase());
  const overlapTerms = overlaps.map((o) => o.term.toLowerCase());

  it('finds the real gaps', () => {
    expect(gapTerms).toEqual(expect.arrayContaining(['kubernetes', 'terraform']));
  });

  it('does NOT report things the résumé evidences', () => {
    for (const held of ['typescript', 'postgresql', 'go', 'stripe']) {
      expect(gapTerms).not.toContain(held);
    }
  });

  // ⚠️ THE PROPERTY THE WHOLE FEATURE RESTS ON.
  it('cites a real résumé line for every overlap', () => {
    expect(overlaps.length).toBeGreaterThan(0);
    for (const o of overlaps) {
      expect(o.evidence).toBeTruthy();
      // The citation must be a line that genuinely exists in what they pasted.
      expect(RESUME).toContain(o.evidence);
    }
  });

  it('tells the person which posting line asked for each gap', () => {
    for (const g of gaps) expect(POSTING).toContain(g.source);
  });

  it('finds an overlap buried in prose, not only in the skills list', () => {
    // "Docker" appears once, inside an experience bullet. A matcher that only read the Skills
    // section would call it a gap.
    const m = matchPostingToResume(RESUME, 'Requirements\n- Experience with Docker\n');
    expect(m.gaps.map((g) => g.term.toLowerCase())).not.toContain('docker');
  });

  it('reports inconclusive rather than implying a perfect match', () => {
    const m = matchPostingToResume(RESUME, '   \n  \n');
    expect(m.inconclusive).toBe(true);
    expect(m.gaps).toHaveLength(0);
  });

  it('is not inconclusive when it genuinely found things', () => {
    expect(inconclusive).toBe(false);
  });

  it('invents nothing about the person — every term traces to the posting', () => {
    for (const t of [...overlapTerms, ...gapTerms]) {
      expect(POSTING.toLowerCase()).toContain(t);
    }
  });
});

describe('the under-report asymmetry', () => {
  it('prefers silence to a wrong gap when the résumé spells a skill differently', () => {
    // "Postgres" vs "PostgreSQL" — loose matching must treat these as the same thing rather
    // than telling a Postgres DBA they've never used Postgres.
    const r = 'Skills\nPostgres · Node';
    const m = matchPostingToResume(r, 'Requirements\n- Strong PostgreSQL knowledge\n');
    expect(m.gaps.map((g) => g.term.toLowerCase())).not.toContain('postgresql');
  });

  it('still reports a genuine absence', () => {
    const m = matchPostingToResume('Skills\nPostgres · Node', 'Requirements\n- Experience with Elixir\n');
    expect(m.gaps.map((g) => g.term.toLowerCase())).toContain('elixir');
  });
});

describe('term noise', () => {
  it('drops a fragment when the same line yields the fuller phrase', () => {
    // A real run listed both "Design systems" AND "Design", the latter citing the person's job
    // title — true, and useless. Keep the specific claim, discard the vague one.
    const m = matchPostingToResume(
      'Skills\nDesign systems · Figma',
      'Requirements\n- Deep knowledge of Design systems\n',
    );
    const terms = m.overlaps.map((o) => o.term);
    expect(terms).toContain('Design systems');
    expect(terms).not.toContain('Design');
  });

  it('never removes a term that stands on its own', () => {
    const m = matchPostingToResume('Skills\nGo', 'Requirements\n- Experience with Go and Rust\n');
    const all = [...m.overlaps.map((o) => o.term), ...m.gaps.map((g) => g.term)].map((t) => t.toLowerCase());
    expect(all).toEqual(expect.arrayContaining(['go', 'rust']));
  });
});
