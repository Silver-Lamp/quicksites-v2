import { TemplateSaveSchema } from './zod/templateSaveSchema';
import type { ValidatedTemplate } from './zod/templateSaveSchema';
import { migrateLegacyTemplate } from './migrateLegacyTemplate';

/**
 * Validates and normalizes a full template object.
 */
export function validateTemplateAndFix(input: any): {
  valid: boolean;
  data?: ValidatedTemplate;
  errors?: any;
} {
  if (!input || typeof input !== 'object') {
    return {
      valid: false,
      errors: {
        formErrors: ['Template is empty or invalid structure'],
        fieldErrors: {},
      },
    };
  }

  // Step 1: flatten and unwrap any legacy .data wrappers
  const migrated = migrateLegacyTemplate(input);

  // Step 2: prepare safe structure
  const allowedKeys = Object.keys(TemplateSaveSchema.shape);
  const cleaned: Record<string, any> = {};

  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(migrated, key)) {
      cleaned[key] = migrated[key];
    }
  }

  // Step 3: explicitly remove dangerous leftovers
  delete cleaned.created_at;
  delete cleaned.domain;
  delete cleaned.custom_domain;
  delete cleaned.data;

  // Step 4: inject required field defaults
  cleaned.slug ??= 'new-template-' + Math.random().toString(36).slice(2, 6);
  cleaned.template_name ??= cleaned.slug;
  cleaned.layout ??= 'standard';
  cleaned.color_scheme ??= 'neutral';
  cleaned.theme ??= 'default';

  // Step 5: validate
  const result = TemplateSaveSchema.safeParse(cleaned);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.flatten(),
    };
  }

  return {
    valid: true,
    data: result.data as ValidatedTemplate,
  };
}
