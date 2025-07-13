'use client';

import { useState } from 'react';
import { defaultGridPresets } from '@/types/grid-presets';
import RenderBlock from './render-block';
import { normalizeBlock } from '@/types/blocks';
import { Button } from '@/components/ui/button';

export default function GridPresetPlayground() {
  const [selected, setSelected] = useState(defaultGridPresets[0]);
  const [blocks, setBlocks] = useState(selected.items.map(normalizeBlock));
  const [columns, setColumns] = useState(selected.columns);

  const applyPreset = (name: string) => {
    const preset = defaultGridPresets.find((p) => p.name === name);
    if (!preset) return;
    setSelected(preset);
    setBlocks(preset.items.map(normalizeBlock));
    setColumns(preset.columns);
  };

  return (
    <div className="space-y-4 p-4 border rounded bg-muted/10">
      <div className="flex gap-2 items-center">
        <span className="text-sm text-muted-foreground">Preset:</span>
        <select
          value={selected.name}
          onChange={(e) => applyPreset(e.target.value)}
          className="rounded bg-muted text-sm text-white px-2 py-1"
        >
          {defaultGridPresets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className={`grid grid-cols-${columns} gap-4`}>
        {blocks.map((block, i) => (
          <div
            key={block._id}
            id={`block-${block._id}`}
            className="border border-white/10 bg-muted rounded p-2 text-white"
          >
            <RenderBlock block={block} />
          </div>
        ))}
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={() => alert('🎯 Ready to drop this preset into a page!')}
      >
        Insert This Preset
      </Button>
    </div>
  );
}
