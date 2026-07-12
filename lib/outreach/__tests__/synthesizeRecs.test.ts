/**
 * @jest-environment node
 */
// lib/outreach/__tests__/synthesizeRecs.test.ts
//
// The LLM synthesis is grounded + best-effort; unit-test the pure JSON validator + the
// enable gate (the network call itself isn't exercised here).

import { parseTopThree, geoRecsLlmEnabled } from '@/lib/outreach/recSummary';

describe('parseTopThree', () => {
  it('parses {steps:[…]} and caps at 3', () => {
    const raw = JSON.stringify({
      steps: [
        { title: 'Get reviews', why: 'match competitors' },
        { title: 'Add city page', why: 'target the term' },
        { title: 'Fix title', why: 'lift CTR' },
        { title: 'Extra', why: 'dropped' },
      ],
    });
    const out = parseTopThree(raw)!;
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ title: 'Get reviews', why: 'match competitors' });
  });

  it('accepts a bare array and coerces detail→why', () => {
    const out = parseTopThree(JSON.stringify([{ title: 'A', detail: 'because' }]))!;
    expect(out[0]).toEqual({ title: 'A', why: 'because' });
  });

  it('drops entries without a title, returns null when empty/invalid', () => {
    expect(parseTopThree(JSON.stringify({ steps: [{ why: 'no title' }] }))).toBeNull();
    expect(parseTopThree('not json')).toBeNull();
    expect(parseTopThree(null)).toBeNull();
  });
});

describe('geoRecsLlmEnabled', () => {
  const OLD = { flag: process.env.GEO_RECS_LLM_ENABLED, key: process.env.OPENAI_API_KEY };
  afterEach(() => {
    process.env.GEO_RECS_LLM_ENABLED = OLD.flag;
    process.env.OPENAI_API_KEY = OLD.key;
  });
  it('requires both the flag and an API key', () => {
    process.env.GEO_RECS_LLM_ENABLED = '1';
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(geoRecsLlmEnabled()).toBe(true);
    process.env.OPENAI_API_KEY = '';
    expect(geoRecsLlmEnabled()).toBe(false);
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GEO_RECS_LLM_ENABLED = '0';
    expect(geoRecsLlmEnabled()).toBe(false);
  });
});
