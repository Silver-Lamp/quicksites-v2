'use client';

import type { Block } from '@/types/blocks';

export default function FallbackRenderer({ block }: { block: Partial<Block> }) {
  return (
    <div className="p-4 mb-4 border border-yellow-500 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
      <strong>⚠️ Unknown block type:</strong>{' '}
      <code className="bg-white/20 px-1 rounded">{block?.type || 'undefined'}</code>
      <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
        This block is not yet implemented or failed to load. Please check the block schema or editor config.
      </p>
    </div>
  );
}
