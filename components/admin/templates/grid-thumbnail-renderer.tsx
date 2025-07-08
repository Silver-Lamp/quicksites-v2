// components/admin/templates/grid-thumbnail-renderer.tsx
"use client";

import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import type { GridPreset } from '@/types/grid-presets';
import RenderBlock from './render-block';
import { normalizeBlock } from '@/types/blocks';

export default function GridThumbnailRenderer({
  preset,
  onSelect,
}: {
  preset: GridPreset;
  onSelect?: (preset: GridPreset) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cached = localStorage.getItem(`preset_thumb:${preset.name}`);
    if (cached) {
      setPreviewUrl(cached);
      return;
    }

    const generate = async () => {
      if (!ref.current) return;
      const canvas = await html2canvas(ref.current, { backgroundColor: 'transparent' });
      const dataUrl = canvas.toDataURL('image/png');
      setPreviewUrl(dataUrl);
      localStorage.setItem(`preset_thumb:${preset.name}`, dataUrl);
    };
    generate();
  }, [preset]);

  return (
    <div className="relative">
      {previewUrl ? (
        <div className="relative group">
          <img
            src={previewUrl}
            alt={`Preview of ${preset.name}`}
            className="rounded border border-white/10 w-full"
          />
          {onSelect && (
            <button
              onClick={() => onSelect(preset)}
              className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 text-white text-xs font-medium rounded transition-opacity"
            >
              ➕ Use This Layout
            </button>
          )}
        </div>
      ) : (
        <div
          ref={ref}
          className={`grid grid-cols-${preset.columns} gap-2 p-2 opacity-0 pointer-events-none fixed top-[-9999px] left-[-9999px]`}
        >
          {preset.items.map((block, i) => (
            <div
              key={i}
              className="border border-white/10 bg-white/5 rounded px-2 py-1 text-center text-[11px] text-white"
            >
              <RenderBlock block={normalizeBlock(block)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
