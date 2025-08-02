import { TemplateSaveSchema } from '@/admin/lib/zod/templateSaveSchema';

export function validateAndLogTemplate(template: any) {
  const result = TemplateSaveSchema.safeParse(template);

  if (!result.success) {
    console.error('[❌ Template validation failed]', result.error.flatten());
    return {
      valid: false,
      errors: result.error.flatten(),
    };
  }

  console.log('[✅ Template valid]', result.data);
  return {
    valid: true,
    data: result.data,
  };
}
