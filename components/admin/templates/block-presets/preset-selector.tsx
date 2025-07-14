'use client';

import type { BlockWithId } from '@/types/blocks';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { blockMeta } from '@/admin/lib/zod/blockSchema';
import RenderBlockMini from '@/components/admin/templates/render-block-mini';

type Props = {
  onSelect: (block: BlockWithId) => void;
  onHover?: (block: BlockWithId | null) => void;
};

export default function PresetSelector({ onSelect, onHover }: Props) {
  const types = Object.keys(blockMeta) as BlockWithId['type'][];

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {types.map((type) => {
        const meta = blockMeta[type as keyof typeof blockMeta];
        const block = createDefaultBlock(type);

        return (
          <li
            key={type}
            className="border dark:border-neutral-700 bg-white dark:bg-neutral-900 text-black dark:text-white rounded overflow-hidden shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-neutral-800 transition cursor-pointer"
            onClick={() => onSelect(block as unknown as BlockWithId)}
            onMouseEnter={() => onHover?.(block as unknown as BlockWithId | null)}
            onMouseLeave={() => onHover?.(null)}
          >
            <div className="p-3 space-y-2 h-full flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{meta.icon}</span>
                <span className="font-semibold text-gray-800 dark:text-white">
                  {meta.label}
                </span>
              </div>
              <div className="border-t dark:border-neutral-700 pt-2">
                <RenderBlockMini block={block} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
