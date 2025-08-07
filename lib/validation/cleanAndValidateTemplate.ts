// lib/validation/cleanAndValidateTemplate.ts
import { TemplateSaveSchema } from '@/admin/lib/zod/templateSaveSchema';

const extraKeysToStrip = [
  'created_at',
  'updated_at',
  'domain',
  'custom_domain',
  'logo_url_meta',
  'hero_url_meta',
  'gallery_meta',
  'banner_url_meta',
  'name',
  'archived',
  'editor_id',
  'search_engines_last_pinged_at',
  'search_engines_last_ping_response',
  'claimed_by',
  'claimed_at',
  'claim_source',
];

function stripExtraKeys<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: any = {};
  for (const key in obj) {
    if (!extraKeysToStrip.includes(key)) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

export function cleanAndValidateTemplate(input: any) {
  const cleaned = stripExtraKeys(input);
  return TemplateSaveSchema.parse(cleaned);
}
