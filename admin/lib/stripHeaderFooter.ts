// admin/lib/stripHeaderFooter.ts
import type { Template } from '@/types/template';

/**
 * Remove any headerBlock/footerBlock from a template JSON.
 * - Deletes top-level headerBlock/footerBlock
 * - Deletes data.headerBlock/footerBlock
 * - Leaves headerOverride/footerOverride on pages (untouched)
 */
export function stripHeaderFooterBlocks<T extends Partial<Template>>(tpl: T): T {
  if (!tpl) return tpl;

  const clone: any = structuredClone(tpl);

  // Remove top-level
  if ('headerBlock' in clone) delete clone.headerBlock;
  if ('footerBlock' in clone) delete clone.footerBlock;

  // Remove nested inside .data
  if (clone.data) {
    if ('headerBlock' in clone.data) delete clone.data.headerBlock;
    if ('footerBlock' in clone.data) delete clone.data.footerBlock;
  }

  return clone as T;
}
