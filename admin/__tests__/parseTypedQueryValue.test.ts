import { parseTypedQueryValue } from '@/admin/lib/query/parseTypedQueryValue';
import { expect, describe, it, vi } from 'vitest';
import { z } from 'zod';

const mockRouter = {
  replace: vi.fn(),
} as any;

describe('parseTypedQueryValue', () => {
  it('parses number', () => {
    expect(
      parseTypedQueryValue('age', '42', 0, 'number', undefined, mockRouter)
    ).toBe(42);
  });

  it('returns fallback on NaN', () => {
    expect(
      parseTypedQueryValue('age', 'abc', 7, 'number', undefined, mockRouter)
    ).toBe(7);
  });

  it('parses json object with schema', () => {
    const schema = z.object({ name: z.string() });
    const encoded = encodeURIComponent(JSON.stringify({ name: 'Test' }));
    expect(
      parseTypedQueryValue('config', encoded, {}, 'json', schema, mockRouter)
    ).toEqual({
      name: 'Test',
    });
  });

  it('returns fallback on invalid json', () => {
    expect(
      parseTypedQueryValue(
        'config',
        '%7Bbad-json',
        {},
        'json',
        undefined,
        mockRouter
      )
    ).toEqual({});
  });

  it('parses boolean correctly', () => {
    expect(
      parseTypedQueryValue(
        'enabled',
        'true',
        false,
        'boolean',
        undefined,
        mockRouter
      )
    ).toBe(true);
    expect(
      parseTypedQueryValue(
        'enabled',
        'false',
        true,
        'boolean',
        undefined,
        mockRouter
      )
    ).toBe(false);
  });

  it('handles json[] array', () => {
    const encoded1 = encodeURIComponent(JSON.stringify({ id: 1 }));
    const encoded2 = encodeURIComponent(JSON.stringify({ id: 2 }));
    const result = parseTypedQueryValue(
      'arr',
      [encoded1, encoded2],
      [],
      'json[]',
      undefined,
      mockRouter
    );
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('returns fallback for empty array', () => {
    expect(
      parseTypedQueryValue(
        'empty',
        [],
        [1, 2],
        'number[]',
        undefined,
        mockRouter
      )
    ).toEqual([1, 2]);
  });
});
