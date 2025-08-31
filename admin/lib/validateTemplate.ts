'use client';

import { ZodError } from 'zod';
import { TemplateSaveSchema } from './zod/templateSaveSchema';
import type { ValidatedTemplate } from './zod/templateSaveSchema';
import { migrateLegacyTemplate } from './migrateLegacyTemplate';
import { canonicalizeUrlKeysDeep } from './migrations/canonicalizeUrls';
import { upgradeLegacyBlocksDeep } from '@/lib/blocks/upgradeLegacy';

/* ----------------------------- small helpers ----------------------------- */

type Warning = { field: 'headerBlock' | 'footerBlock'; message: string };

function getAtPath(obj: unknown, pathSegments: (string | number)[]) {
  try {
    let cur: any = obj;
    for (const seg of pathSegments) {
      const key = typeof seg === 'number' ? seg : /^\d+$/.test(String(seg)) ? Number(seg) : seg;
      cur = cur?.[key];
    }
    return cur;
  } catch {
    return undefined;
  }
}

function getInnerZodObject(schema: any): any {
  return schema?.innerType?.() ?? schema?._def?.schema ?? schema;
}

function getAllowedTemplateKeys(): string[] {
  const inner = getInnerZodObject(TemplateSaveSchema);
  const shape =
    inner?._def?.shape?.() ??
    (typeof inner?.shape === 'function' ? inner.shape() : inner?.shape);
  return shape && typeof shape === 'object' ? Object.keys(shape) : [];
}

/* --------------------------------- API ----------------------------------- */

export type ValidateResult =
  | { valid: true; data: ValidatedTemplate; warnings: Warning[] }
  | {
      valid: false;
      errors:
        | {
            formErrors: string[];
            fieldErrors: Record<string, string[]>;
            rows?: Array<{ path: string; code: string; message: string; value: unknown }>;
          }
        | Error
        | ZodError;
    };

/**
 * Validates and normalizes a full template object.
 * - Migrates legacy template wrapper
 * - Canonicalizes url-ish keys
 * - Upgrades legacy block shapes (props->content, hero key mapping, safe defaults)
 * - Preserves `.data` so TemplateSaveSchema's preprocessor can hoist `data.pages`
 */
export function validateTemplateAndFix(input: unknown): ValidateResult {
  if (!input || typeof input !== 'object') {
    return {
      valid: false,
      errors: { formErrors: ['Template is empty or invalid structure'], fieldErrors: {} },
    };
  }

  // 0) Migrate & canonicalize
  const migrated = migrateLegacyTemplate(input as Record<string, any>) ?? {};
  const normalized = canonicalizeUrlKeysDeep(migrated);

  // 1) Strip to allowed top-level keys to match schema
  const allowedKeys = getAllowedTemplateKeys();
  const cleaned: Record<string, any> = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      cleaned[key] = (normalized as any)[key];
    }
  }
  delete cleaned.created_at;
  delete cleaned.domain;
  delete cleaned.custom_domain;

  // 2) Identity basics (sane defaults)
  cleaned.slug ??= 'new-template-' + Math.random().toString(36).slice(2, 6);
  cleaned.template_name ??= cleaned.slug;
  cleaned.layout ??= 'standard';
  cleaned.color_scheme ??= 'neutral';
  cleaned.theme ??= 'default';
  if (cleaned.color_mode == null) cleaned.color_mode = 'dark';

  // 3) **Upgrade legacy blocks** at root pages and nested data.pages
  if (Array.isArray(cleaned.pages)) {
    cleaned.pages = upgradeLegacyBlocksDeep({ pages: cleaned.pages }).pages;
  }
  if (cleaned.data && typeof cleaned.data === 'object') {
    cleaned.data = upgradeLegacyBlocksDeep(cleaned.data);
  }

  // 4) Validate against the schema
  const result = TemplateSaveSchema.safeParse(cleaned);
  if (!result.success) {
    const rows = result.error.errors.map((e) => ({
      path: e.path.join('.'),
      code: e.code,
      message: e.message,
      value: getAtPath(cleaned, e.path),
    }));

    // Keep a compact console table for debugging (dev only)
    // eslint-disable-next-line no-console
    console.groupCollapsed('[validateTemplateAndFix] schema errors');
    try {
      // eslint-disable-next-line no-console
      console.table(rows);
    } catch {
      // eslint-disable-next-line no-console
      console.log(rows);
    }
    // eslint-disable-next-line no-console
    console.groupEnd();

    return { valid: false, errors: { ...result.error.flatten(), rows } };
  }

  // --- success ---
  const t: any = result.data;

  // Ensure data.pages exists and mirrors root pages
  if (!Array.isArray(t?.data?.pages)) {
    if (Array.isArray(t.pages)) {
      t.data = { ...(t.data ?? {}), pages: t.pages };
    } else {
      t.data = { ...(t.data ?? {}), pages: [] };
    }
  }

  const warnings: Warning[] = [];
  // Optionally emit warnings about header/footer if you want:
  // if (!t.headerBlock && !t?.data?.headerBlock) warnings.push({ field: 'headerBlock', message: 'Global header is missing.' });
  // if (!t.footerBlock && !t?.data?.footerBlock) warnings.push({ field: 'footerBlock', message: 'Global footer is missing.' });

  return { valid: true, data: t as ValidatedTemplate, warnings };
}