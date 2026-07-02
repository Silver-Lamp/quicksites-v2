// lib/commerce/__tests__/inventory.test.ts
import { normalizeStock, readItemStock, checkStock } from '../inventory';

describe('normalizeStock', () => {
  it('treats null/undefined/empty as untracked (null)', () => {
    expect(normalizeStock(null)).toBeNull();
    expect(normalizeStock(undefined)).toBeNull();
    expect(normalizeStock('')).toBeNull();
    expect(normalizeStock('abc')).toBeNull();
  });
  it('coerces to a non-negative integer', () => {
    expect(normalizeStock(5)).toBe(5);
    expect(normalizeStock('3')).toBe(3);
    expect(normalizeStock(2.9)).toBe(2);
    expect(normalizeStock(-4)).toBe(0);
    expect(normalizeStock(0)).toBe(0);
  });
});

describe('readItemStock', () => {
  it('reads metadata.stock, untracked when absent', () => {
    expect(readItemStock({ stock: 7 })).toBe(7);
    expect(readItemStock({})).toBeNull();
    expect(readItemStock(null)).toBeNull();
  });
});

describe('checkStock', () => {
  it('always allows an untracked line', () => {
    expect(checkStock(null, 999)).toEqual({ ok: true });
  });
  it('rejects when sold out', () => {
    expect(checkStock(0, 1)).toEqual({ ok: false, reason: 'sold_out' });
  });
  it('rejects when requesting more than available', () => {
    expect(checkStock(3, 5)).toEqual({ ok: false, reason: 'insufficient' });
  });
  it('allows up to the available amount', () => {
    expect(checkStock(3, 3)).toEqual({ ok: true });
    expect(checkStock(3, 2)).toEqual({ ok: true });
  });
});
