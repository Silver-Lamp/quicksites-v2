import type { Template } from '@/types/template';
import { normalizePageBlocks } from './normalizePageBlocks';

export function fixAllBlocks(template: Template): Template {
  return {
    ...template,
    data: {
      ...template.data,
      pages: template.data.pages.map(normalizePageBlocks),
    },
  };
}
