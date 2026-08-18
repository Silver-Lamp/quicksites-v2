// lib/ci/__tests__/prClaims.test.ts
//
// The check has to be able to FAIL, and it has to fail for the right reason. A gate that passes
// everything is the same silence-looks-like-success failure as a permanently-red CI row: it trains
// you to stop reading it.
import { readClaims, explain } from '@/lib/ci/prClaims';

describe('readClaims — accepts a real claims block', () => {
  it('reads bullet claims', () => {
    const v = readClaims(['# Title', '', '## Claims', '- one thing', '- another thing'].join('\n'));
    expect(v).toEqual({ ok: true, claims: ['one thing', 'another thing'] });
  });

  it('accepts prose without bullets', () => {
    const v = readClaims('## Claims\nNo existing rows violate the new key.');
    expect(v.ok).toBe(true);
  });

  it('accepts `none` — a typo fix bets on nothing, and saying so is the point', () => {
    const v = readClaims('## Claims\nnone');
    expect(v).toEqual({ ok: true, claims: ['none'] });
  });

  it('accepts any heading level and any casing rather than fighting the author', () => {
    for (const h of ['# Claims', '### claims', '###### CLAIMS']) {
      expect(readClaims(`${h}\n- something`).ok).toBe(true);
    }
  });

  it('stops at the next heading, so a later section is not mistaken for claims', () => {
    const v = readClaims('## Claims\n- real claim\n\n## Testing\n- ran jest');
    expect(v).toEqual({ ok: true, claims: ['real claim'] });
  });
});

describe('readClaims — fails when it should', () => {
  it('rejects a body with no claims heading', () => {
    expect(readClaims('## Summary\nDid a thing.')).toEqual({ ok: false, reason: 'missing_heading' });
  });

  it('rejects an empty body', () => {
    expect(readClaims('')).toEqual({ ok: false, reason: 'missing_heading' });
    expect(readClaims(null)).toEqual({ ok: false, reason: 'missing_heading' });
  });

  it('rejects a heading with nothing under it', () => {
    expect(readClaims('## Claims\n\n## Testing\n- ran jest')).toEqual({ ok: false, reason: 'empty_section' });
  });

  // The load-bearing one. The PR template explains the rule in an HTML comment; if comments
  // counted as content, every PR would pass by virtue of the template that asks the question.
  it('does not let the template\'s own guidance satisfy the rule it explains', () => {
    const body = '## Claims\n<!-- one to three lines, each checkable. `none` is legal. -->';
    expect(readClaims(body)).toEqual({ ok: false, reason: 'empty_section' });
  });

  it('does not count an unfilled checkbox as a claim', () => {
    expect(readClaims('## Claims\n- [ ]')).toEqual({ ok: false, reason: 'empty_section' });
  });
});

describe('explain', () => {
  it('tells a failing author what to write, not merely that they failed', () => {
    const msg = explain(readClaims('nothing here'));
    expect(msg).toContain('## Claims');
    expect(msg).toContain('none');
    // States that it is author-satisfiable, so nobody "fixes" that later thinking it a loophole.
    expect(msg).toMatch(/satisfiable by you alone/);
  });

  it('is quiet on success', () => {
    expect(explain(readClaims('## Claims\n- a\n- b'))).toBe('Claims block found (2 lines).');
  });
});
