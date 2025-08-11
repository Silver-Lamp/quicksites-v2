// lib/blocks/validateBlockSchemaCoverage.ts
import { blockContentSchemaMap } from '@/admin/lib/zod/blockSchema';
import { BLOCK_REGISTRY } from '@/lib/blockRegistry';

export function validateBlockSchemaCoverage() {
  // If you have blocks that intentionally don't need a renderer, list them here.
  // Example: const IGNORE = new Set(['grid']);
  const IGNORE = new Set<string>([]);

  const schemaKeys = Object.keys(blockContentSchemaMap)
    .filter((k) => !IGNORE.has(k))
    .sort();

  const registryKeys = Object.keys(BLOCK_REGISTRY)
    .filter((k) => !IGNORE.has(k))
    .sort();

  const missingInRegistry = schemaKeys.filter((k) => !registryKeys.includes(k));
  const missingInSchemas = registryKeys.filter((k) => !schemaKeys.includes(k));

  if (missingInRegistry.length || missingInSchemas.length) {
    console.warn('⚠️ Block schema coverage mismatch:\n');

    if (missingInRegistry.length) {
      console.warn('⛔️ Missing in BLOCK_REGISTRY:', missingInRegistry);
    }
    if (missingInSchemas.length) {
      console.warn('⛔️ Missing in blockContentSchemaMap:', missingInSchemas);
    }
  } else {
    console.log('✅ BLOCK_REGISTRY and blockContentSchemaMap are in sync!');
  }
}
