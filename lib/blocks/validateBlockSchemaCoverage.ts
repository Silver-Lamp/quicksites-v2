// lib/blocks/validateBlockSchemaCoverage.ts
import { blockContentSchemaMap } from '@/admin/lib/zod/blockSchema';
import { STATIC_RENDERERS, DYNAMIC_RENDERERS } from '@/lib/renderBlockRegistry';

export function validateBlockSchemaCoverage() {
  // If you have blocks that intentionally don't need a renderer, list them here.
  // Example: const IGNORE = new Set(['grid']);
  const IGNORE = new Set<string>([]);

  const schemaKeys = Object.keys(blockContentSchemaMap)
    .filter((k) => !IGNORE.has(k))
    .sort();

  // Compare against the union of static + dynamic renderer keys
  const rendererKeys = Array.from(
    new Set([
      ...Object.keys(STATIC_RENDERERS),
      ...Object.keys(DYNAMIC_RENDERERS),
    ])
  )
    .filter((k) => !IGNORE.has(k))
    .sort();

  const missingRenderers = schemaKeys.filter((k) => !rendererKeys.includes(k));
  const orphanRenderers = rendererKeys.filter((k) => !schemaKeys.includes(k));

  if (missingRenderers.length || orphanRenderers.length) {
    // eslint-disable-next-line no-console
    console.warn('⚠️ Block schema coverage mismatch:\n');

    if (missingRenderers.length) {
      // eslint-disable-next-line no-console
      console.warn('⛔️ Schema has no renderer for:', missingRenderers);
    }
    if (orphanRenderers.length) {
      // eslint-disable-next-line no-console
      console.warn('⛔️ Renderer exists but no schema for:', orphanRenderers);
    }
  } else {
    // eslint-disable-next-line no-console
    console.log('✅ Schemas and renderers are in sync!');
  }
}
