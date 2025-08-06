// admin/lib/zod/blockSchemas/fromContentMap.ts
import { z, ZodTypeAny } from 'zod';
import { BlockContentMap } from '@/types/blocks';
import { stringOrEmpty } from '../sharedHelpers';

type InferSchema<T> = {
  [K in keyof T]: T[K] extends string
    ? z.ZodString
    : T[K] extends number
    ? z.ZodNumber
    : T[K] extends boolean
    ? z.ZodBoolean
    : T[K] extends string[]
    ? z.ZodArray<z.ZodString>
    : T[K] extends { [key: string]: any }
    ? z.ZodTypeAny // You can recurse if you want nested typing
    : z.ZodTypeAny;
};

// Convert raw object types into Zod schemas
export function generateZodObjectSchema<T extends Record<string, any>>(shape: T): z.ZodObject<any> {
  const entries = Object.entries(shape).map(([key, val]) => {
    let schema: ZodTypeAny;

    switch (typeof val) {
      case 'string':
        schema = z.string();
        break;
      case 'number':
        schema = z.number();
        break;
      case 'boolean':
        schema = z.boolean();
        break;
      case 'object':
        if (Array.isArray(val)) {
          schema = z.array(z.string()); // Simplified assumption
        } else {
          schema = z.any(); // Nested object: handle manually if needed
        }
        break;
      default:
        schema = z.any();
    }

    return [key, schema.optional()];
  });

  return z.object(Object.fromEntries(entries));
}
