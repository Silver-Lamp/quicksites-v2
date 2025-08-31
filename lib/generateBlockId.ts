// lib/generateBlockId.ts
import { v4 as uuidv4 } from 'uuid';

/** Safe UUID for browser/edge/node without assuming crypto is present. */
function genId(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  return g?.crypto?.randomUUID?.() ?? uuidv4();
}

/** Try to coerce various weird inputs into a usable string id. */
function coerceId(input: unknown): string | null {
  if (typeof input === 'string' && input.trim()) return input.trim();
  if (typeof input === 'number' && Number.isFinite(input)) return String(input);

  // arrays like ['a','b','c'] or [97,98] → 'abc' / '9798'
  if (Array.isArray(input)) {
    if (input.every(v => typeof v === 'string' || typeof v === 'number')) {
      return input.map(v => String(v)).join('');
    }
    return null;
  }

  if (input && typeof input === 'object') {
    // nested {_id:'...'} or {0:'a',1:'b',...}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: any = input;
    if (typeof obj._id === 'string' && obj._id.trim()) return obj._id.trim();
    const vals = Object.values(obj);
    if (vals.length && vals.every(v => typeof v === 'string' || typeof v === 'number')) {
      return vals.map(v => String(v)).join('');
    }
  }

  return null;
}

/**
 * Normalize a block so it ALWAYS has a valid `id` string.
 * - Prefers existing `id`, then `_id`, then generates a new one.
 * - Mirrors to `_id` for backward-compat with older code.
 */
export function ensureBlockId<T extends Record<string, any>>(block: T): T & { id: string; _id: string } {
  const existing = coerceId(block?.id) ?? coerceId(block?._id);
  const id = existing ?? genId();
  return {
    ...block,
    id,
    _id: block?._id ?? id,
  };
}

/**
 * Optional helper: ensure all blocks have unique ids.
 * If duplicates are detected, later duplicates get new ids.
 */
export function ensureUniqueBlockIds<T extends { id?: unknown; _id?: unknown }>(blocks: T[]): Array<T & { id: string; _id: string }> {
  const seen = new Set<string>();
  return blocks.map((b) => {
    let out = ensureBlockId(b as any);
    if (seen.has(out.id)) {
      const fresh = genId();
      out = { ...out, id: fresh, _id: out._id ?? fresh };
    }
    seen.add(out.id);
    return out;
  });
}
