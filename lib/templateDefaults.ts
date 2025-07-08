import type { ValidatedTemplate } from '@/admin/lib/zod/templateSaveSchema';

export const templateDefaults: Omit<ValidatedTemplate, 'id' | 'name' | 'slug'> = {
  layout: 'default',
  color_scheme: '',
//   commit: '',
  industry: '',
  theme: '',
//   brand: '',
//   site_id: undefined,
  updated_at: new Date().toISOString(),
  data: {
    pages: [],
  },
};
