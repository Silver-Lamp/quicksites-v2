// admin/lib/withTemplateDefaults.ts

/**
 * Ensures required top-level fields are present on a template.
 * Safe to run before validation or before saving.
 */
export function withTemplateDefaults(template: Record<string, any>): Record<string, any> {
    const result = { ...template };
  
    result.slug ??= 'new-template-' + Math.random().toString(36).slice(2, 6);
    result.template_name ??= result.slug;
    result.layout ??= 'standard';
    result.color_scheme ??= 'neutral';
    result.theme ??= 'default';
  
    return result;
  }
  