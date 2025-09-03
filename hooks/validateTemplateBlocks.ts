// hooks/validateTemplateBlocks.ts
'use client';

import type { Template } from '@/types/template';
import type { ZodIssue, ZodTypeAny } from 'zod';
import { blockContentSchemaMap } from '@/admin/lib/zod/blockSchema';
import type { Block } from '@/types/blocks';
import { schemaFor } from '@/types/blocks';
import { resolveCanonicalType } from '@/lib/blockRegistry.core';

export type BlockValidationError = {
  field: string;                 // e.g. "content.heading"
  message: string;               // human-friendly message
  code?: string;                 // zod issue code (invalid_type, too_small, etc.)
  expected?: unknown;            // when available (invalid_type, etc.)
  received?: unknown;            // when available
  path?: (string | number)[];    // raw zod path
  hint?: string;                 // extra guidance we add
};

/** Convert a ZodIssue into a richer, consistent error object. */
function explainIssue(issue: ZodIssue): BlockValidationError {
  const path = (issue.path ?? []) as (string | number)[];
  const field = path.length ? path.join('.') : '(root)';
  const code = (issue as any).code as string | undefined;

  let message = issue.message || 'Invalid';
  let expected: unknown = (issue as any).expected;
  let received: unknown = (issue as any).received;
  let hint: string | undefined;

  switch (code) {
    case 'invalid_type': {
      // expected/received usually set by zod
      if (received === 'undefined') {
        message = 'Missing required value';
        hint = 'Provide a value for this field.';
      } else {
        message = `Expected ${String(expected)}, got ${String(received)}`;
      }
      break;
    }
    case 'too_small': {
      const t = (issue as any).type;
      const min = (issue as any).minimum;
      if (t === 'string') {
        message = `Must have at least ${min} character${min === 1 ? '' : 's'}`;
      } else if (t === 'array') {
        message = `Must include at least ${min} item${min === 1 ? '' : 's'}`;
      } else if (t === 'number') {
        message = `Must be ≥ ${min}`;
      }
      break;
    }
    case 'too_big': {
      const t = (issue as any).type;
      const max = (issue as any).maximum;
      if (t === 'string') {
        message = `Must have at most ${max} character${max === 1 ? '' : 's'}`;
      } else if (t === 'array') {
        message = `Must include at most ${max} item${max === 1 ? '' : 's'}`;
      } else if (t === 'number') {
        message = `Must be ≤ ${max}`;
      }
      break;
    }
    case 'invalid_enum_value': {
      const opts = (issue as any).options;
      expected = opts;
      message = `Must be one of: ${Array.isArray(opts) ? opts.join(', ') : String(opts)}`;
      break;
    }
    case 'unrecognized_keys': {
      const keys = (issue as any).keys || [];
      message = `Remove unknown key${keys.length === 1 ? '' : 's'}: ${keys.join(', ')}`;
      break;
    }
    case 'invalid_union': {
      message = 'Does not match any allowed shape';
      hint = 'Check required fields and field types for this block.';
      break;
    }
    default: {
      // keep issue.message; add small hints for common patterns
      if (/required/i.test(issue.message) && !hint) {
        hint = 'This field is required.';
      }
    }
  }

  return { field, message, code, expected, received, path, hint };
}

/** Resolve alias → canonical, then get a Zod schema from the editor map or shared types. */
function getSchemaForType(inputType: string | undefined | null): ZodTypeAny | null {
  if (!inputType) return null;
  const canonical = resolveCanonicalType(inputType);
  if (!canonical) return null;

  // Prefer editor-side zod map
  const s1 = (blockContentSchemaMap as any)?.[canonical];
  if (s1 && typeof s1.safeParse === 'function') return s1 as ZodTypeAny;

  // Fallback to shared schema resolver (if exposed)
  const s2 = (schemaFor as any)?.(canonical);
  if (s2 && typeof s2.safeParse === 'function') return s2 as ZodTypeAny;

  return null;
}

/**
 * Validate all blocks on all pages (resolving canonical types first).
 * Produces a map: blockId -> BlockValidationError[]
 */
export function validateTemplateBlocks(tpl: Template): Record<string, BlockValidationError[]> {
  const out: Record<string, BlockValidationError[]> = {};
  const pages: any[] =
    (tpl as any)?.data?.pages ??
    (tpl as any)?.pages ??
    [];

  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi] || {};
    const blocks: any[] = page?.content_blocks ?? page?.blocks ?? [];

    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi] || {};
      const id: string = b?._id ?? b?.id ?? `page${pi}-index${bi}`;
      const type: string | undefined = b?.type;

      const errs: BlockValidationError[] = [];

      if (!type) {
        errs.push({
          field: 'type',
          message: 'Block is missing a type',
          code: 'missing_type',
          hint: 'Add a valid "type" field for this block.',
        });
        out[id] = errs;
        continue;
      }

      const schema = getSchemaForType(type);

      if (!schema) {
        const canonical = resolveCanonicalType(type);
        errs.push({
          field: 'type',
          message: `Unknown block type "${type}"`,
          code: 'unknown_type',
          hint:
            `Make sure "${canonical ?? type}" is registered in blockContentSchemaMap or provided by schemaFor, and that resolveCanonicalType maps aliases.`,
        });
        out[id] = errs;
        continue;
      }

      // Validate entire block object (schemas should be defined for full block shape)
      const parsed = schema.safeParse(b);
      if (!parsed.success) {
        const issues: ZodIssue[] = parsed.error?.issues ?? [];
        if (issues.length === 0) {
          errs.push({ field: '(root)', message: 'Invalid block', code: 'invalid' });
        } else {
          for (const issue of issues) {
            errs.push(explainIssue(issue));
          }
        }
      }

      if (errs.length) out[id] = errs;
    }
  }

  return out;
}

/**
 * Some flows might push non-standard errors (strings, partial objects).
 * Normalize everything to BlockValidationError so the UI is consistent.
 */
export function normalizeBlockErrors(
  raw: Record<string, any[]>
): Record<string, BlockValidationError[]> {
  const out: Record<string, BlockValidationError[]> = {};
  for (const [blockId, arr] of Object.entries(raw || {})) {
    const list: BlockValidationError[] = [];
    for (const e of arr || []) {
      if (!e) continue;
      if (typeof e === 'string') {
        list.push({ field: '(root)', message: e, code: 'custom' });
      } else if (typeof e === 'object') {
        const obj = e as Partial<BlockValidationError>;
        list.push({
          field: obj.field ?? '(root)',
          message: obj.message ?? 'Invalid',
          code: obj.code,
          expected: obj.expected,
          received: obj.received,
          path: Array.isArray(obj.path) ? obj.path : undefined,
          hint: obj.hint,
        });
      }
    }
    if (list.length) out[blockId] = list;
  }
  return out;
}

/** Validate a single block with canonical resolution + schema fallback. */
export function validateBlockRich(block: Block): BlockValidationError[] {
  const type = (block as any)?.type;
  const schema = getSchemaForType(type);
  if (!schema) {
    const canonical = type ? resolveCanonicalType(type) : null;
    return [{
      field: 'type',
      message: `Unknown block type "${type ?? '(missing)'}"`,
      code: 'unknown_type',
      hint:
        `Register "${canonical ?? type ?? '(unknown)'}" in blockContentSchemaMap or provide it via schemaFor; ensure resolveCanonicalType covers aliases.`,
    }];
  }
  const r = schema.safeParse(block);
  if (r.success) return [];
  const issues: ZodIssue[] = r.error?.issues ?? [];
  return issues.length ? issues.map(explainIssue) : [{ field: '(root)', message: 'Invalid block', code: 'invalid' }];
}

/** Pick messages for a field path prefix (for inline field errors). */
export function pickFieldErrorsFor(pathPrefix: string, errs: BlockValidationError[]): string[] {
  const p = pathPrefix.endsWith('.') ? pathPrefix : `${pathPrefix}.`;
  return errs
    .filter(e => e.field === pathPrefix || e.field.startsWith(p))
    .map(e => e.message);
}
