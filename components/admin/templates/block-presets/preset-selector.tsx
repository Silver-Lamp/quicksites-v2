'use client';

import { useState } from 'react';
import { blockPresets } from './block-presets';
import type { BlockWithId } from '@/types/blocks';
import PresetPreviewCard from './PresetPreviewCard';

export default function PresetSelector({
  onSelect,
  onHover,
}: {
  onSelect: (block: BlockWithId) => void;
  onHover?: (block: BlockWithId | null) => void;
}) {
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const allTags = Array.from(new Set(blockPresets.flatMap((p) => p.tags)));

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const visiblePresets = activeTags.length
    ? blockPresets.filter((preset) => activeTags.every((t) => preset.tags.includes(t)))
    : blockPresets;

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`text-sm px-2 py-1 rounded border ${
              activeTags.includes(tag)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-neutral-800'
            }`}
          >
            #{tag}
          </button>
        ))}
        {activeTags.length > 0 && (
          <button
            onClick={() => setActiveTags([])}
            className="text-sm ml-2 px-2 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50 dark:border-red-400 dark:hover:bg-red-800"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {visiblePresets.map((preset) => {
          const preview = preset.generate();
          return (
            <button
              key={preset.type}
              onClick={() => onSelect(preview)}
              onMouseEnter={() => onHover?.(preview)}
              onMouseLeave={() => onHover?.(null)}
              className="border border-gray-300 dark:border-gray-700 rounded hover:ring-2 hover:ring-blue-500 transition-all"
            >
              <PresetPreviewCard block={preview} />
            </button>
          );
        })}
      </div>
    </>
  );
}