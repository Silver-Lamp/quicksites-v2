// admin/lib/handleTemplateSave.ts
'use client';

import toast from 'react-hot-toast';
import type { Template } from '@/types/template';
import { ZodError } from 'zod';
import { normalizeTemplate } from '@/admin/utils/normalizeTemplate';
import { TemplateSaveSchema } from '@/admin/lib/zod/templateSaveSchema';
import { validateTemplateBlocks } from '@/hooks/validateTemplateBlocks';
import { printZodErrors } from '@/admin/lib/printZodErrors';
import { saveTemplate } from '@/admin/lib/saveTemplate';
import { saveSite } from '@/admin/lib/saveSite';
import { ensureValidTemplateFields } from '@/admin/utils/ensureValidTemplateFields';
import { unwrapData } from '@/admin/lib/cleanTemplateData';
import { ensureBlockId } from '@/admin/lib/ensureBlockId';
import { TemplateFormSchema } from '@/types/template';
import { canonicalizeUrlKeysDeep } from '@/admin/lib/migrations/canonicalizeUrls';

// ─────────────────────────────────────
// utils

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').trim();
}

const normalizeUuid = (v: any) =>
  typeof v === 'string' && v.trim() === '' ? null : v ?? null;

function getAtPath(obj: unknown, path: (string | number)[]) {
  try {
    let cur: any = obj;
    for (const seg of path) {
      const key = typeof seg === 'number' ? seg : /^\d+$/.test(String(seg)) ? Number(seg) : seg;
      cur = cur?.[key];
    }
    return cur;
  } catch {
    return undefined;
  }
}

// ─────────────────────────────────────

export async function handleTemplateSave({
  rawJson,
  mode = 'template',
  onSuccess,
  onError,
  scrollToBlock = true,
}: {
  rawJson: string;
  mode: 'template' | 'site';
  onSuccess?: (saved: Template) => void;
  onError?: (error: ZodError | string) => void;
  scrollToBlock?: boolean;
}): Promise<void> {
  try {
    // 1) Parse JSON
    const parsedRaw = JSON.parse(rawJson);

    // 1a) Canonicalize url-ish keys (deep): imageUrl -> image_url, logoUrl -> logo_url, navItems -> nav_items, etc.
    //     This also fixes header/footer/editor drift before any validation.
    const candidate = canonicalizeUrlKeysDeep(parsedRaw);

    // 1b) Normalize UUID-ish fields
    candidate.site_id = normalizeUuid(candidate.site_id);
    if (Array.isArray(candidate.pages)) {
      candidate.pages = candidate.pages.map((p: any) => ({
        ...p,
        site_id: normalizeUuid(p?.site_id),
      }));
    }
    if (Array.isArray(candidate?.data?.pages)) {
      candidate.data.pages = candidate.data.pages.map((p: any) => ({
        ...p,
        site_id: normalizeUuid(p?.site_id),
      }));
    }
    if (candidate.data?.site_id !== undefined) {
      candidate.data.site_id = normalizeUuid(candidate.data.site_id);
    }

    // 1c) Capture pages up-front (prevents drops through transforms)
    const capturedPages =
      (Array.isArray(candidate.pages) && candidate.pages.length > 0
        ? candidate.pages
        : Array.isArray(candidate?.data?.pages)
        ? candidate.data.pages
        : []) ?? [];

    // 2) Permissive form validation (loosest gate)
    const parsed = TemplateFormSchema.passthrough().safeParse(candidate);
    if (!parsed.success) {
      printZodErrors(parsed.error, '❌ Template Validation Failed (Form)');
      toast.error('Validation failed — check console for details.');
      onError?.(parsed.error);
      return;
    }

    // 3) Normalize + ensure base fields
    const normalized = normalizeTemplate(parsed.data);
    const base = ensureValidTemplateFields(normalized);

    // 4) Flatten `.data.data` and re-inject captured pages
    const cleanedData = unwrapData(base.data);
    base.data = {
      ...cleanedData,
      services: Array.isArray(cleanedData?.services) ? cleanedData.services : [],
      pages:
        capturedPages.length > 0
          ? capturedPages
          : Array.isArray(cleanedData?.pages)
          ? cleanedData.pages
          : [],
    };

    // 5) Enforce slugs + block IDs
    if (Array.isArray(base.data?.pages)) {
      base.data.pages = base.data.pages.map((page: any, i: number) => ({
        ...page,
        slug: page.slug || slugify(page.title || `page-${i}`),
        content_blocks: Array.isArray(page.content_blocks)
          ? page.content_blocks.map(ensureBlockId)
          : [],
      }));
    }

    // Debug: ensure we still have pages
    console.debug(
      '[handleTemplateSave] about to validate, page count =',
      Array.isArray(base.data?.pages) ? base.data.pages.length : 0
    );

    // 6) Sanitize phone
    base.phone = typeof base.phone === 'string' ? base.phone : '';

    // 6.1) Default color_mode if null/undefined
    if (base.color_mode == null) base.color_mode = 'dark'; // or 'light'

    // 7) Block validation + final schema
    const { errors: blockErrors } = validateTemplateBlocks(base);

    // NOTE: TemplateSaveSchema is a ZodEffects; do NOT call .passthrough() here.
    const result = TemplateSaveSchema.safeParse(base);

    // Helper: first block error (for toast + scroll)
    const getFirstBlockError = () => {
      if (!blockErrors) return undefined;
      for (const [blockId, msgs] of Object.entries(blockErrors)) {
        const msg = Array.isArray(msgs) ? msgs[0] : (msgs as any);
        if (msg) return { blockId, msg: String(msg) };
      }
      return undefined;
    };

    const firstBlockErr = getFirstBlockError();

    if (!result.success || firstBlockErr) {
      if (!result.success) {
        // Pretty console table with offending values
        const rows = result.error.errors.map((e) => ({
          path: e.path.join('.'),
          code: e.code,
          message: e.message,
          value: getAtPath(base, e.path),
        }));
        console.groupCollapsed('❌ Template Validation Failed (Schema)');
        try {
          console.table(rows);
        } catch {
          console.log(rows);
        }
        console.groupEnd();

        // Keep your existing detailed printer too
        printZodErrors(result.error, '❌ Template Validation Failed (Schema)');
      }

      if (firstBlockErr) {
        console.error('❌ Block validation failed', {
          first: firstBlockErr,
          all: blockErrors,
        });
        if (scrollToBlock) {
          const el = document.getElementById(`block-${firstBlockErr.blockId}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }

      const flat = !result.success ? result.error.flatten?.() : undefined;
      const firstField = flat ? Object.keys(flat.fieldErrors ?? {})[0] : undefined;
      const firstFieldErr = firstField
        ? flat?.fieldErrors?.[firstField as keyof typeof flat.fieldErrors]?.[0]
        : undefined;

      toast.error(
        firstBlockErr?.msg ||
          firstFieldErr ||
          'Validation failed — check console for details.'
      );
      onError?.(!result.success ? result.error : (firstBlockErr?.msg ?? 'invalid'));
      return;
    }

    // 8) Strip editor-only fields and save
    const saveFn = mode === 'template' ? saveTemplate : saveSite;
    const payload: Template = { ...base, data: base.data };
    delete (payload as any).pages;
    delete (payload as any).services;

    const promise = saveFn(payload);
    toast.promise(promise, {
      loading: 'Saving...',
      success: 'Template saved!',
      error: 'Failed to save',
    });

    const saved = await promise;
    onSuccess?.(saved);
  } catch (err: any) {
    console.error('Invalid JSON while saving template:', err);
    toast.error('Invalid JSON. Fix formatting and try again.');
    onError?.(err.message || 'invalid');
  }
}
