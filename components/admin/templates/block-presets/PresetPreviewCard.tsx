'use client';

import type { Block } from '@/types/blocks';

export default function PresetPreviewCard({
  block,
}: {
  block: Block;
}) {
  return (
    <div className="w-full border border-gray-300 dark:border-gray-700 rounded p-2 bg-white dark:bg-neutral-900 text-sm text-gray-800 dark:text-gray-100">
      <strong className="block mb-1 capitalize">{block.type}</strong>
      {block.type === 'text' && <p>{block.content.value}</p>}
      {block.type === 'quote' && <blockquote className="italic">“{block.content.text}”</blockquote>}
      {block.type === 'hero' && (
        <div>
          <h2 className="text-base font-semibold">{block.content.headline}</h2>
          <p className="text-xs">{block.content.subheadline}</p>
        </div>
      )}
      {block.type === 'cta' && (
        <p>
          CTA: <code>{block.content.label}</code> → <code>{block.content.link}</code>
        </p>
      )}
      {block.type === 'button' && (
        <p>
          Button: <strong>{block.content.label}</strong>
        </p>
      )}
      {block.type === 'image' && (
        <img
          src={block.content.url}
          alt={block.content.alt}
          className="max-h-24 object-cover w-full rounded"
        />
      )}
      {/* Fallback for unknown */}
      {!['text', 'quote', 'hero', 'cta', 'button', 'image'].includes(block.type) && (
        <p className="text-xs italic text-gray-500">No preview available.</p>
      )}
    </div>
  );
}