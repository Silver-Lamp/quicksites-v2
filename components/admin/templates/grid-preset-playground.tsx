// components/admin/templates/grid-preset-playground.tsx
'use client';

import { useState } from 'react';
import { defaultGridPresets } from '@/types/grid-presets';
import RenderBlock from './render-block';
import { Button } from '@/components/ui/button';
import { normalizeBlock } from '@/lib/utils/normalizeBlock';
import type { Block } from '@/types/blocks';

type GridPreset = (typeof defaultGridPresets)[number];

function safeNormalize(b: unknown): Block {
  try {
    return normalizeBlock(b as Partial<Block>) as unknown as Block;
  } catch {
    return {
      type: 'text',
      _id: crypto.randomUUID(),
      content: { value: '[Invalid block in preset]' },
    } as unknown as Block;
  }
}

export default function GridPresetPlayground() {
  const [selected, setSelected] = useState<GridPreset>(defaultGridPresets[0]);
  const [blocks, setBlocks] = useState<Block[]>(
    selected.items.map(safeNormalize)
  );
  const [columns, setColumns] = useState<number>(selected.columns ?? 2);
  const [colorMode] = useState<'light' | 'dark'>('dark');

  const applyPreset = (name: string) => {
    const preset = defaultGridPresets.find((p) => p.name === name);
    if (!preset) return;
    setSelected(preset);
    setBlocks(preset.items.map(safeNormalize));
    setColumns(preset.columns ?? 2);
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

      {/* Use inline grid-template-columns so Tailwind doesn't purge dynamic classes */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {blocks.map((block) => (
          <div
            key={block._id ?? crypto.randomUUID()}
            id={`block-${block._id}`}
            className="border border-white/10 bg-muted rounded p-2 text-white"
          >
            <RenderBlock
              block={block}
              showDebug={false}
              colorMode={colorMode}
            />
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
