// hooks/validateTemplateBlocks.ts
import { BlockSchema } from '@/admin/lib/zod/blockSchema';
import type { Template } from '@/types/template';

export type BlockValidationError = {
  field: string;
  message: string;
  blockId?: string;
  blockType?: string;
};

export function validateTemplateBlocks(template: Template): {
  isValid: boolean;
  errors: Record<string, BlockValidationError[]>;
} {
  const errors: Record<string, BlockValidationError[]> = {};
  let criticalErrorCount = 0;

  const addError = (key: string, err: BlockValidationError, critical = true) => {
    if (!errors[key]) errors[key] = [];
    errors[key].push(err);
    if (critical) criticalErrorCount += 1;
  };

  // -------- Global header/footer (single source of truth) --------
  // Warn if missing; do not fail validation.
  if (!template.headerBlock) {
    addError(
      'headerBlock',
      {
        field: 'headerBlock',
        message:
          'Warning: Global headerBlock is missing. Pages will render without a header unless a per-page override is set.',
      },
      /* critical */ false
    );
  } else {
    const result = BlockSchema.safeParse(template.headerBlock);
    if (!result.success) {
      result.error.errors.forEach((e) =>
        addError('headerBlock', {
          field: e.path.join('.'),
          message: e.message,
          blockId: (template.headerBlock as any)?._id,
          blockType: (template.headerBlock as any)?.type,
        })
      );
    }
  }

  if (!template.footerBlock) {
    addError(
      'footerBlock',
      {
        field: 'footerBlock',
        message:
          'Warning: Global footerBlock is missing. Pages will render without a footer unless a per-page override is set.',
      },
      /* critical */ false
    );
  } else {
    const result = BlockSchema.safeParse(template.footerBlock);
    if (!result.success) {
      result.error.errors.forEach((e) =>
        addError('footerBlock', {
          field: e.path.join('.'),
          message: e.message,
          blockId: (template.footerBlock as any)?._id,
          blockType: (template.footerBlock as any)?.type,
        })
      );
    }
  }

  // -------- Pages & blocks --------
  const pages = template?.data?.pages;
  if (!Array.isArray(pages)) {
    return { isValid: criticalErrorCount === 0, errors };
  }

  pages.forEach((page, pageIndex) => {
    const pageKeyBase = page?.slug || `page-${pageIndex}`;

    // Validate page-level overrides if present
    if (page?.headerOverride) {
      const res = BlockSchema.safeParse(page.headerOverride);
      if (!res.success) {
        res.error.errors.forEach((e) =>
          addError(`${pageKeyBase}-headerOverride`, {
            field: e.path.join('.'),
            message: e.message,
            blockId: (page.headerOverride as any)?._id,
            blockType: (page.headerOverride as any)?.type,
          })
        );
      }
    }
    if (page?.footerOverride) {
      const res = BlockSchema.safeParse(page.footerOverride);
      if (!res.success) {
        res.error.errors.forEach((e) =>
          addError(`${pageKeyBase}-footerOverride`, {
            field: e.path.join('.'),
            message: e.message,
            blockId: (page.footerOverride as any)?._id,
            blockType: (page.footerOverride as any)?.type,
          })
        );
      }
    }

    // Validate page body blocks (skip header/footer types; those are global and will be ignored)
    const blocks = Array.isArray(page?.content_blocks) ? page.content_blocks : [];
    blocks.forEach((block: any, blockIndex: number) => {
      const t = block?.type;
      if (t === 'header' || t === 'footer') {
        // Non-fatal warning: header/footer should not live in page content; they are global.
        addError(
          `${pageKeyBase}-block-${block._id ?? blockIndex}`,
          {
            field: 'type',
            message:
              'Warning: header/footer found in page content. These are ignored; use global headerBlock/footerBlock or page overrides.',
            blockId: block?._id,
            blockType: t,
          },
          /* critical */ false
        );
        return;
      }

      const result = BlockSchema.safeParse(block);
      if (!result.success) {
        const key = block?._id ?? `${pageKeyBase}-block-${blockIndex}`;
        result.error.errors.forEach((e) =>
          addError(key, {
            field: e.path.join('.'),
            message: e.message,
            blockId: block?._id,
            blockType: block?.type,
          })
        );
      }
    });
  });

  return {
    isValid: criticalErrorCount === 0,
    errors,
  };
}
