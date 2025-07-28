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

    // Normalize and ensure required fields are present
    const normalized = normalizeTemplate(parsed);
    const base = ensureValidTemplateFields(normalized);

    const { errors: blockErrors } = validateTemplateBlocks(base);
    const result = TemplateSaveSchema.safeParse(base);

    if (!result.success || Object.keys(blockErrors).length > 0) {
      printZodErrors(result.error as ZodError, '❌ Template Validation Failed');

      const flat = result.error?.flatten?.();
      const firstField = Object.keys(flat?.fieldErrors ?? {})[0];
      const firstError = flat?.fieldErrors?.[firstField as keyof typeof flat.fieldErrors]?.[0];

      // Try to scroll to first invalid block
      if (scrollToBlock && result.error?.issues?.length && result.error.issues.length > 0) {
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

    // Safe to save
    const { services, ...safeToSave } = base;
    const saveFn = mode === 'template' ? saveTemplate : saveSite;

    const promise = saveFn(safeToSave);

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
