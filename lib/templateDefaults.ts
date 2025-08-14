import type { ValidatedTemplate } from '@/admin/lib/zod/templateSaveSchema';

export const templateDefaults: Omit<ValidatedTemplate, 'id' | 'name' | 'slug'> = {
  template_name: '',
  layout: 'default',
  color_scheme: 'dark',
  industry: '',
  theme: '',
  updated_at: new Date().toISOString(),
  services: [],
  data: {
    pages: [],
    services: [],
  },
};
