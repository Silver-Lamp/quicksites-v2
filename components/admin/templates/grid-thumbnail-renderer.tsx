'use client';

import type { GridPreset } from '@/types/grid-presets';
import { normalizeBlock } from '@/types/blocks';
import RenderBlock from './render-block';

type Props = {
  preset: GridPreset;
  onSelect?: (preset: GridPreset) => void;
};

export default function GridThumbnailRenderer({ preset, onSelect }: Props) {
  return (
    <div
      className={`grid gap-2 mb-1 grid-cols-${preset.columns}`}
    >
      {preset.items.map((block, i) => (
        <div key={i} id={`block-${block._id}`} className="border border-white/10 rounded p-1 text-xs text-white bg-white/5" onClick={() => onSelect?.(preset)}>
          <RenderBlock block={normalizeBlock(block)} showDebug={false} />
        </div>
      ))}
    </div>
  );
}
