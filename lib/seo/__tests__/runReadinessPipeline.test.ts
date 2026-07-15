/**
 * @jest-environment node
 */
// lib/seo/__tests__/runReadinessPipeline.test.ts
//
// Only the pure classifier is unit-tested here — the runner↔action-key parity is guaranteed
// at compile time by READINESS_RUNNERS: Record<ReadinessActionKey, …>, and the pipeline itself
// hits the DB (covered by the action/registry tests + manual verification).

import { classifyStep } from '@/lib/seo/pipelineClassify';

describe('classifyStep', () => {
  it('maps a real change to "ran"', () => {
    expect(classifyStep({ changed: true })).toBe('ran');
  });
  it('maps already-satisfied no-ops to "satisfied"', () => {
    expect(classifyStep({ changed: false, reason: 'already' })).toBe('satisfied');
    expect(classifyStep({ changed: false, reason: 'already_exists' })).toBe('satisfied');
  });
  it('maps other no-ops to "noop"', () => {
    expect(classifyStep({ changed: false, reason: 'no_parks' })).toBe('noop');
    expect(classifyStep({ changed: false })).toBe('noop');
  });
  it('maps an error result to "error" (even alongside other fields)', () => {
    expect(classifyStep({ changed: false, error: 'boom' })).toBe('error');
    expect(classifyStep({ changed: true, error: 'boom' })).toBe('error');
  });
});
