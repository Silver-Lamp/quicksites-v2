// lib/blocks/generateBlockDocs.ts
import { blockSchemas } from '@/admin/lib/zod/blockSchemas';
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

export function generateBlockDocs(): Record<string, BlockDoc> {
  return Object.fromEntries(
    Object.entries(blockSchemas).map(([type, schema]) => {
      const contentShape = (schema as any).shape.content.shape as Record<string, any>;
      const fields = Object.fromEntries(
        Object.entries(contentShape).map(([key, val]) => {
          return [key, describeZodField(val)];
        })
      );

      const meta = (schema as any)._meta ?? {};
      const defaultContent = DEFAULT_BLOCK_CONTENT?.[type as keyof typeof DEFAULT_BLOCK_CONTENT] ?? {};

      return [
        type,
        {
          type,
          label: meta.label || type,
          description: meta.description || '',
          icon: meta.icon || '📦',
          fields,
          defaultContent,
        },
      ];
    })
  );
}
