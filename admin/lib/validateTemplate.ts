// lib/validateTemplate.ts
'use client';

import { ZodError } from 'zod';
import { TemplateSaveSchema } from './zod/templateSaveSchema';
import type { ValidatedTemplate } from './zod/templateSaveSchema';
import { migrateLegacyTemplate } from './migrateLegacyTemplate';
import { canonicalizeUrlKeysDeep } from './migrations/canonicalizeUrls';

/** Safe getter for "a.b.0.c" style paths from Zod errors */
function getAtPath(obj: unknown, pathSegments: (string | number)[]) {
  try {
    let cur: any = obj;
    for (const seg of pathSegments) {
      const key =
        typeof seg === 'number'
          ? seg
          : /^\d+$/.test(String(seg))
          ? Number(seg)
          : seg;
      cur = cur?.[key];
    }
    return cur;
  } catch {
    return undefined;
  }
}

/** Get the inner ZodObject from a ZodEffects produced by z.preprocess */
function getInnerZodObject(schema: any): any {
  // zod v3: ZodEffects exposes inner schema via .innerType() or _def.schema
  return schema?.innerType?.() ?? schema?._def?.schema ?? schema;
}

/** Allowed top-level keys from TemplateSaveSchema (handles preprocess) */
function getAllowedTemplateKeys(): string[] {
  const inner = getInnerZodObject(TemplateSaveSchema);
  const shape =
    inner?._def?.shape?.() ??
    (typeof inner?.shape === 'function' ? inner.shape() : inner?.shape);
  return shape && typeof shape === 'object' ? Object.keys(shape) : [];
}

export type ValidateResult =
  | { valid: true; data: ValidatedTemplate }
  | {
      valid: false;
      errors:
        | {
            /** For UI banners */
            formErrors: string[];
            fieldErrors: Record<string, string[]>;
            /** For console debugging */
            rows?: Array<{
              path: string;
              code: string;
              message: string;
              value: unknown;
            }>;
          }
        | Error
        | ZodError;
    };

/**
 * Validates and normalizes a full template object.
 * - Unwraps legacy .data
 * - Canonicalizes url-ish keys (imageUrl → image_url, logoUrl → logo_url, navItems → nav_items) across the whole object
 * - Preserves `.data` so TemplateSaveSchema's preprocessor can hoist `data.pages` -> `pages`
 * - Provides rich diagnostics (flattened + rows with offending values)
 */
export function validateTemplateAndFix(input: unknown): ValidateResult {
  // Guard: must be an object
  if (!input || typeof input !== 'object') {
    return {
      valid: false,
      errors: {
        formErrors: ['Template is empty or invalid structure'],
        fieldErrors: {},
      },
    };
  }

  // 1) Migrate legacy shapes (unwrap nested .data, etc.)
  const migrated = migrateLegacyTemplate(input as Record<string, any>) ?? {};

  // 2) Canonicalize url-ish keys deeply (imageUrl → image_url, etc.)
  const normalized = canonicalizeUrlKeysDeep(migrated);

  // 3) Prepare a "clean" object limited to schema-known keys
  //    NOTE: keep `.data` intact so schema preprocess can read `data.pages`.
  const allowedKeys = getAllowedTemplateKeys();
  const cleaned: Record<string, any> = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      cleaned[key] = (normalized as any)[key];
    }
  }

  // 4) Remove risky server-managed fields if present (but DO NOT remove .data)
  delete cleaned.created_at;
  delete cleaned.domain;
  delete cleaned.custom_domain;

  // 5) Inject safe defaults (only when missing)
  cleaned.slug ??= 'new-template-' + Math.random().toString(36).slice(2, 6);
  cleaned.template_name ??= cleaned.slug;
  cleaned.layout ??= 'standard';
  cleaned.color_scheme ??= 'neutral';
  cleaned.theme ??= 'default';
  if (cleaned.color_mode == null) cleaned.color_mode = 'dark'; // keep consistent with save path

  // 6) Validate with Zod
  const result = TemplateSaveSchema.safeParse(cleaned);

  if (!result.success) {
    // Build friendly debug rows
    const rows = result.error.errors.map((e) => ({
      path: e.path.join('.'),
      code: e.code,
      message: e.message,
      value: getAtPath(cleaned, e.path),
    }));

    // Console diagnostics (collapsed)
    console.groupCollapsed('❌ [validateTemplateAndFix] schema errors');
    try {
      console.table(rows);
    } catch {
      console.log(rows);
    }
    console.groupEnd();

    return {
      valid: false,
      errors: {
        ...result.error.flatten(),
        rows,
      },
    };
  }

  // 7) Post-parse normalization: ensure data.pages exists
  const t: any = result.data;

  if (!Array.isArray(t?.data?.pages)) {
    if (Array.isArray(t.pages)) {
      t.data = { ...(t.data ?? {}), pages: t.pages };
    } else if (typeof t.pages === 'string') {
      try {
        t.data = { ...(t.data ?? {}), pages: JSON.parse(t.pages) };
      } catch {
        t.data = { ...(t.data ?? {}), pages: [] };
      }
    } else {
      t.data = { ...(t.data ?? {}), pages: [] };
    }
  }

  return {
    valid: true,
    data: t as ValidatedTemplate,
  };
}
