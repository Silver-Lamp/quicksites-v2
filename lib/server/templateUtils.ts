import { createHash } from 'crypto';

export function sha256(obj: unknown) {
  return createHash('sha256').update(JSON.stringify(obj ?? {})).digest('hex');
}

export function applyTombstones(base: any, paths: string[] = []) {
  for (const p of paths) {
    const parts = p.split('.'); let cur = base;
    while (parts.length > 1) {
      const k = parts.shift()!;
      if (!(k in cur) || cur[k] == null) { cur = null; break; }
      cur = cur[k];
    }
    if (cur && parts.length === 1) delete cur[parts[0]];
  }
  return base;
}

// Deep-merge "defined only". Arrays are replaced, not merged.
export function deepMergeDefined<T>(target: T, patch: any): T {
  if (patch === undefined) return target;
  if (Array.isArray(target) || Array.isArray(patch)) return (patch ?? target) as T;
  if (typeof target !== 'object' || target === null) return (patch ?? target) as T;
  const out: any = Array.isArray(target) ? [...(target as any)] : { ...(target as any) };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v === undefined) continue;
    out[k] = deepMergeDefined((out as any)[k], v);
  }
  return out as T;
}

export function patchPaths(patch: any, base = '', acc: string[] = []): string[] {
  if (!patch || typeof patch !== 'object') return acc;
  if (Array.isArray(patch)) return acc; // treat arrays as atomic
  for (const [k, v] of Object.entries(patch)) {
    if (k === '__delete__') continue;
    const p = base ? `${base}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      patchPaths(v, p, acc);
    } else {
      acc.push(p);
    }
  }
  return acc;
}
