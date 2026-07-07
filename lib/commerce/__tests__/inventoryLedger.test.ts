// lib/commerce/__tests__/inventoryLedger.test.ts
import { resolveManualAdjustment } from '../inventoryLedger';

describe('resolveManualAdjustment', () => {
  it('computes a delta from an absolute target (correction)', () => {
    expect(resolveManualAdjustment(10, { setTo: 4 })).toEqual({ delta: -6, reason: 'correction' });
    expect(resolveManualAdjustment(3, { setTo: 8 })).toEqual({ delta: 5, reason: 'correction' });
  });
  it('infers reason from a signed delta', () => {
    expect(resolveManualAdjustment(0, { delta: 5 })).toEqual({ delta: 5, reason: 'receive' });
    expect(resolveManualAdjustment(9, { delta: -2 })).toEqual({ delta: -2, reason: 'manual' });
  });
  it('honors an explicit reason', () => {
    expect(resolveManualAdjustment(0, { delta: 12, reason: 'receive' })).toEqual({ delta: 12, reason: 'receive' });
  });
  it('is a no-op (null) when nothing changes or input is invalid', () => {
    expect(resolveManualAdjustment(5, { setTo: 5 })).toBeNull();
    expect(resolveManualAdjustment(5, { delta: 0 })).toBeNull();
    expect(resolveManualAdjustment(5, { setTo: -1 })).toBeNull();
    expect(resolveManualAdjustment(5, { delta: 'x' as any })).toBeNull();
  });
});
