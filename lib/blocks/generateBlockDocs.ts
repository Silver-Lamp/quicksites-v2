// lib/blocks/generateBlockDocs.ts
import { z } from 'zod';
import {
  blockContentSchemaMap as blockSchemas,
  blockMeta,
} from '@/admin/lib/zod/blockSchema';

import { DEFAULT_BLOCK_CONTENT } from './defaultBlockContent';
import { describeZodField } from './describeZodField';

type BlockDoc = {
  type: string;
  label: string;
  description: string;
  icon: string;
  fields: Record<string, string>;
  defaultContent: Record<string, any>;
};

// best-effort shape getter (works with ZodObject, preprocess/effects-wrapped objects)
function getObjectShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> {
  const def = (schema as any)?._def;
  if (def?.shape) {
    // Some versions expose shape as a function
    const maybeFn = def.shape;
    if (typeof maybeFn === 'function') return maybeFn();
  }
  return (schema as any).shape ?? {};
}

export function generateBlockDocs(): Record<string, BlockDoc> {
  return Object.fromEntries(
    Object.entries(blockSchemas).map(([type, cfg]) => {
      const contentShape = getObjectShape(cfg.schema);

      const fields = Object.fromEntries(
        Object.entries(contentShape).map(([key, val]) => [key, describeZodField(val as z.ZodTypeAny)])
      );

      // Prefer values from the map; fall back to blockMeta; then to sensible defaults
      const label = cfg.label ?? blockMeta?.[type as keyof typeof blockMeta]?.label ?? type;
      const icon = cfg.icon ?? blockMeta?.[type as keyof typeof blockMeta]?.icon ?? '📦';

      const defaultContent =
        DEFAULT_BLOCK_CONTENT?.[type as keyof typeof DEFAULT_BLOCK_CONTENT] ?? {};

      return [
        type,
        {
          type,
          label,
          description: '', // add descriptions to the map if you want these populated
          icon,
          fields,
          defaultContent,
        },
      ];
    })
  );
}
