// components/editor/ThemePreviewArea.tsx
'use client';
import { useEffect, useState } from 'react';
import { MotionBlockWrapper } from './motion-block-wrapper';
import { BlockOverlayControls } from './block-overlay-controls';

const sampleBlocks = [
  { _id: 'hero1', type: 'hero', content: { headline: 'Welcome!', subheadline: 'We get the job done.' } },
  { _id: 'testimonial1', type: 'testimonial', content: { quote: 'They were amazing!', attribution: 'Alex D.' } },
];

export function ThemePreviewArea({
  font,
  primaryColor,
  borderRadius,
}: {
  font: string;
  primaryColor: string;
  borderRadius: string;
}) {
  return (
    <div
      style={{
        '--font-family': font,
        '--primary-color': primaryColor,
        '--radius': borderRadius,
      } as React.CSSProperties}
      className="bg-neutral-800 p-6 rounded shadow-inner text-white font-[var(--font-family)] space-y-4"
    >
      <h3 className="text-lg font-semibold text-white mb-2">Live Preview</h3>

      {sampleBlocks.map((block) => (
        <MotionBlockWrapper key={block._id}>
          <div className="relative border border-white/10 rounded p-4 block-hover">
            <BlockOverlayControls onEdit={() => alert('Edit')} onDelete={() => alert('Delete')} />
            <p className="text-base" style={{ color: 'var(--primary-color)' }}>{block.type.toUpperCase()}</p>
            <p className="text-sm">{JSON.stringify(block.content)}</p>
          </div>
        </MotionBlockWrapper>
      ))}
    </div>
  );
}
