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

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();
}

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
    const parsed = JSON.parse(rawJson);

    // Step 1: Normalize + ensure base fields
    const normalized = normalizeTemplate(parsed);
    const base = ensureValidTemplateFields(normalized);

    // Step 2: Flatten `.data.data` early
    const cleanedData = unwrapData(base.data);
    base.data = {
      ...cleanedData,
      pages: Array.isArray(cleanedData.pages) ? cleanedData.pages : [],
      services: Array.isArray(cleanedData.services) ? cleanedData.services : [],
    };

    // Step 3: Enforce valid slugs + block IDs
    base.data.pages = base.data.pages.map((page, i) => ({
      ...page,
      slug: page.slug || slugify(page.title || `page-${i}`),
      content_blocks: Array.isArray(page.content_blocks)
        ? page.content_blocks.map(ensureBlockId)
        : [],
    }));

    // Step 4: Sanitize phone (nullable input bug)
    base.phone = typeof base.phone === 'string' ? base.phone : '';

    // Step 5: Validate
    const { errors: blockErrors } = validateTemplateBlocks(base);
    const result = TemplateSaveSchema.safeParse(base);

    if (!result.success || Object.keys(blockErrors).length > 0) {
      printZodErrors(result.error as ZodError, '❌ Template Validation Failed');

      const flat = result.error?.flatten?.();
      const firstField = Object.keys(flat?.fieldErrors ?? {})[0];
      const firstError = flat?.fieldErrors?.[firstField as keyof typeof flat.fieldErrors]?.[0];

      if (scrollToBlock && result.error?.issues?.length) {
        const blockPath = result.error.issues.find((issue) =>
          issue.path.includes('content_blocks')
        );
        if (blockPath) {
          const idx = blockPath.path.findIndex((p) => p === 'content_blocks');
          const blockIndex = blockPath.path[idx + 1];
          const blockId = base.data.pages?.[0]?.content_blocks?.[blockIndex as number]?._id;
          if (blockId) {
            const el = document.getElementById(`block-${blockId}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }

      toast.error(firstError || 'Template validation failed');
      onError?.(result.error || 'invalid');
      return;
    }

    // Step 6: Strip legacy fields + save
    const saveFn = mode === 'template' ? saveTemplate : saveSite;
    const payload: Template = {
      ...base,
      data: base.data,
    };

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
