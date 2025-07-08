// admin/lib/validateBeforeSave.ts
import { TemplateSaveSchema, ValidatedTemplate } from '@/admin/lib/zod/templateSaveSchema';
import type { Template } from '@/types/template';

/**
 * Validates and strips a Template object for safe DB saving.
 * Throws with detailed console error if invalid.
 */
export function validateBeforeSave(template: Template): ValidatedTemplate {
  const result = TemplateSaveSchema.safeParse({
    ...template,
    updated_at: new Date().toISOString(),
  });

  if (!result.success) {
    console.error('[❌ Template Validation Failed]', result.error.flatten());
    throw new Error('Template validation failed — check formatting and block types.');
  }

  return result.data;
}
