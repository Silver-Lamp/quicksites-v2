// lib/blocks/validateBlockSchemaCoverage.ts
import { blockSchemas } from '@/admin/lib/zod/blockSchemas';
import { BLOCK_REGISTRY } from '@/lib/blockRegistry';

export function validateBlockSchemaCoverage() {
  const schemaKeys = Object.keys(blockSchemas).sort();
  const registryKeys = Object.keys(BLOCK_REGISTRY).sort();

  const missingInRegistry = schemaKeys.filter(k => !registryKeys.includes(k));
  const missingInSchemas = registryKeys.filter(k => !schemaKeys.includes(k));

  if (missingInRegistry.length > 0 || missingInSchemas.length > 0) {
    console.warn('⚠️ Block schema coverage mismatch:\n');

    if (missingInRegistry.length > 0) {
      console.warn('⛔️ Missing in BLOCK_REGISTRY:', missingInRegistry);
    }

    if (missingInSchemas.length > 0) {
      console.warn('⛔️ Missing in blockSchemas:', missingInSchemas);
    }
  } else {
    console.log('✅ BLOCK_REGISTRY and blockSchemas are in sync!');
  }
}
