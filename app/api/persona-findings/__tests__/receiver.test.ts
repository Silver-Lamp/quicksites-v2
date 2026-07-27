/**
 * @jest-environment node
 */
// Pins the three rules of the persona-testing receiver (crosstalk/contracts/persona-testing.md).
// Each is a property a future edit could plausibly break without any type error.

import { priorityFor } from '@/app/api/persona-findings/route';

describe('persona findings — priority', () => {
  it('escalates on a high-severity issue', () => {
    expect(priorityFor([{ severity: 'high' }], 'achieved')).toBe('high');
  });
  it('escalates when the persona was blocked, even with no issues listed', () => {
    expect(priorityFor([], 'blocked')).toBe('high');
    expect(priorityFor([], 'error')).toBe('high');
  });
  it('is low for a clean run', () => {
    expect(priorityFor([], 'achieved')).toBe('low');
  });
});
