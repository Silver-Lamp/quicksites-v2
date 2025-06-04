// utils/jsonSchemaToZod.ts
import { z, ZodTypeAny } from 'zod';

export function jsonSchemaToZod(schema: any): ZodTypeAny {
  if (schema.type === 'object' && schema.properties) {
    const shape: Record<string, ZodTypeAny> = {};
    for (const key in schema.properties) {
      shape[key] = jsonSchemaToZod(schema.properties[key]);
    }
    return z.object(shape);
  }

  if (schema.type === 'array' && schema.items) {
    return z.array(jsonSchemaToZod(schema.items));
  }

  if (schema.type === 'string') {
    return z.string();
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    return z.number();
  }

  if (schema.type === 'boolean') {
    return z.boolean();
  }

  if (schema.type === 'null') {
    return z.null();
  }

  if (schema.enum) {
    return z.enum(schema.enum as [string, ...string[]]);
  }

  return z.any(); // fallback
}
