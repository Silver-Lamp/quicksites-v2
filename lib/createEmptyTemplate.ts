import { v4 as uuidv4 } from 'uuid';
import { generateUniqueTemplateName, slugify } from '@/lib/utils/slug';
import { templateDefaults } from '@/lib/templateDefaults';
import type { ValidatedTemplate } from '@/admin/lib/zod/templateSaveSchema';

export function createEmptyTemplate(name?: string): ValidatedTemplate {
  const safeName = generateUniqueTemplateName(name || 'new-template');
  const safeSlug = slugify(safeName);

  return {
    id: uuidv4(), // ✅ generate valid UUID here
    name: safeName,
    slug: safeSlug,
    ...templateDefaults,
    data: {
      pages: [
        {
          id: 'index',
          slug: 'index',
          title: 'Sample Page',
          content_blocks: [],
        },
      ],
    },
  };
}
