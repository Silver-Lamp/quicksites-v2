'use client';

import { useEffect, useMemo, useState } from 'react';
import { blockPresets } from './block-presets';
import type { BlockWithId } from '@/types/blocks';
import PresetPreviewCard from './PresetPreviewCard';

const FEATURED_TYPES = ['hero', 'cta', 'text'];

export default function PresetSelectorGrouped({
  onSelect,
  onHover,
}: {
  onSelect: (block: BlockWithId) => void;
  onHover?: (block: BlockWithId | null) => void;
}) {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('recent-presets');
    if (stored) {
      setRecent(JSON.parse(stored));
    }
  }, []);

  const handleSelect = (block: BlockWithId) => {
    const updated = [block.type, ...recent.filter((t) => t !== block.type)].slice(0, 5);
    setRecent(updated);
    localStorage.setItem('recent-presets', JSON.stringify(updated));
    onSelect(block);
  };

  const tagGroups = useMemo(() => {
    const groups: Record<string, typeof blockPresets> = {};
    blockPresets.forEach((preset) => {
      preset.tags.forEach((tag) => {
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(preset);
      });
    });
    return groups;
  }, []);

  const sortedTags = Object.keys(tagGroups).sort();

  const recentPresets = recent
    .map((t) => blockPresets.find((p) => p.type === t))
    .filter(Boolean) as typeof blockPresets;

  const featuredPresets = blockPresets.filter((p) => FEATURED_TYPES.includes(p.type));

  return (
    <div className="space-y-8">
      {recentPresets.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">🕘 Recently Used</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {recentPresets.map((preset) => {
              const preview = preset.generate();
              return (
                <button
                  key={preset.type + '-recent'}
                  onClick={() => handleSelect(preview)}
                  onMouseEnter={() => onHover?.(preview)}
                  onMouseLeave={() => onHover?.(null)}
                  className="border border-gray-300 dark:border-gray-700 rounded hover:ring-2 hover:ring-blue-500 transition-all"
                >
                  <PresetPreviewCard block={preview} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">⭐ Featured</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {featuredPresets.map((preset) => {
            const preview = preset.generate();
            return (
              <button
                key={preset.type + '-featured'}
                onClick={() => handleSelect(preview)}
                onMouseEnter={() => onHover?.(preview)}
                onMouseLeave={() => onHover?.(null)}
                className="border border-gray-300 dark:border-gray-700 rounded hover:ring-2 hover:ring-blue-500 transition-all"
              >
                <PresetPreviewCard block={preview} />
              </button>
            );
          })}
        </div>
      </div>

      {sortedTags.map((tag) => (
        <div key={tag}>
          <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
            #{tag}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {tagGroups[tag].map((preset) => {
              const preview = preset.generate();
              return (
                <button
                  key={preset.type + '-tag-' + tag}
                  onClick={() => handleSelect(preview)}
                  onMouseEnter={() => onHover?.(preview)}
                  onMouseLeave={() => onHover?.(null)}
                  className="border border-gray-300 dark:border-gray-700 rounded hover:ring-2 hover:ring-blue-500 transition-all"
                >
                  <PresetPreviewCard block={preview} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}