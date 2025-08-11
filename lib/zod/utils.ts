// lib/zod/utils.ts
import type { ZodTypeAny } from 'zod';

/** Returns the inner ZodObject from a ZodEffects produced by z.preprocess */
export function getInnerZodObject(schema: any): any {
  // z.preprocess -> ZodEffects: innerType() (new) or _def.schema (older)
  return schema?.innerType?.() ?? schema?._def?.schema ?? schema;
}

/** Safely get a ZodObject's shape regardless of version */
export function getZodObjectShape(obj: any): Record<string, any> | null {
  if (!obj) return null;
  // Some versions keep a thunk on _def.shape; others expose .shape() or .shape
  const shapeFromDef = typeof obj?._def?.shape === 'function' ? obj._def.shape() : undefined;
  if (shapeFromDef && typeof shapeFromDef === 'object') return shapeFromDef;

  const shapeFromMethod = typeof obj?.shape === 'function' ? obj.shape() : undefined;
  if (shapeFromMethod && typeof shapeFromMethod === 'object') return shapeFromMethod;

  if (obj?.shape && typeof obj.shape === 'object') return obj.shape;
  return null;
}

/** Top-level keys allowed by a (possibly wrapped) Zod object schema */
export function keysFromSchema(schema: ZodTypeAny): string[] {
  const inner = getInnerZodObject(schema);
  const shape = getZodObjectShape(inner);
  return shape ? Object.keys(shape) : [];
}

/** Pick only allowed keys from an object */
export function pickAllowedKeys<T extends Record<string, any>>(
  input: T,
  allowed: readonly string[]
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(input, k)) out[k] = (input as any)[k];
  }
  return out;
}
