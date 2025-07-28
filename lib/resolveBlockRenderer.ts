import { DYNAMIC_RENDERERS, STATIC_RENDERERS } from '@/lib/renderBlockRegistry'; // or break this out separately
import type { BlockType } from '@/types/blocks';
import { fallbackRenderer } from '@/components/admin/templates/render-block'; // export it if it's private

export function getRendererForBlockType(type: BlockType) {
  if (type in STATIC_RENDERERS) {
    return STATIC_RENDERERS[type as keyof typeof STATIC_RENDERERS];
  }

  if (type in DYNAMIC_RENDERERS) {
    return DYNAMIC_RENDERERS[type as keyof typeof DYNAMIC_RENDERERS];
  }

  return fallbackRenderer({ type } as any); // fallback expects a Block-like object
}
