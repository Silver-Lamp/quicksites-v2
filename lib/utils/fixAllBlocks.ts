import type { Template } from '@/types/template';
import { normalizePageBlocks } from './normalizePageBlocks';

export function fixAllBlocks(template: Template): Template {
  return {
    ...template,
    data: {
      ...template.data,
      // Wrapped, not passed by reference: .map() supplies the ARRAY INDEX as the second
      // argument, which would land in normalizePageBlocks' onDrop slot. tsc caught it.
      pages: template.data?.pages?.map((p) => normalizePageBlocks(p)) || [],
    },
  };
}
