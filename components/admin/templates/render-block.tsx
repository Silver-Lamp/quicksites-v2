// components/admin/templates/render-block.tsx
'use client';

import type { Block } from '@/types/blocks';
import SortableGridBlock from './sortable-grid-block';
import { normalizeBlock } from '@/types/blocks';

export default function RenderBlock({
  block,
  handleNestedBlockUpdate,
}: {
  block: Block;
  handleNestedBlockUpdate?: (updated: Block) => void;
}) {
  switch (block.type) {
    case 'text':
      return <p className="mb-4 text-base text-gray-800">{block.content?.value}</p>;

    case 'image':
      return (
        <img
          src={block.content?.url}
          alt={block.content?.alt}
          className="mb-4 rounded shadow-md max-w-full"
        />
      );

    case 'video':
      return (
        <div className="mb-4">
          <video controls className="max-w-full rounded">
            <source src={block.content?.url} />
          </video>
          {block.content?.caption && (
            <p className="text-sm text-gray-500 mt-1">{block.content.caption}</p>
          )}
        </div>
      );

    case 'audio':
      return (
        <div className="mb-4">
          <iframe
            className="w-full"
            style={{ height: 80 }}
            src={block.content?.url}
            title={block.content?.title || block.content?.provider}
            allow="autoplay; encrypted-media"
            loading="lazy"
          />
        </div>
      );

    case 'quote':
      return (
        <blockquote className="border-l-4 pl-4 italic text-gray-600 mb-4">
          “{block.content?.text}”
          {block.content?.attribution && (
            <footer className="mt-1 text-sm text-right">— {block.content.attribution}</footer>
          )}
        </blockquote>
      );

    case 'button':
      return (
        <a
          href={block.content?.href}
          className={`inline-block px-4 py-2 rounded text-white text-sm mb-4
            ${
              block.content?.style === 'ghost'
                ? 'bg-transparent border'
                : block.content?.style === 'secondary'
                ? 'bg-gray-600'
                : 'bg-blue-600'
            }`}
        >
          {block.content?.label}
        </a>
      );

    case 'grid': {
      const normalizedItems = block.content?.items?.map(normalizeBlock) || [];
      const gridLabel = handleNestedBlockUpdate ? 'Grid (drag enabled)' : 'Grid (static)';
      const columns = block.content?.columns || 1;

      return (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-muted-foreground italic">{gridLabel}</span>
            <span className="text-xs text-muted-foreground">
              {normalizedItems.length} item{normalizedItems.length !== 1 ? 's' : ''}
            </span>
          </div>

          {handleNestedBlockUpdate ? (
            <SortableGridBlock
              columns={columns}
              items={normalizedItems}
              onChange={(updated) => {
                const updatedBlock = {
                  ...block,
                  content: {
                    ...block.content,
                    items: updated,
                  },
                };
                handleNestedBlockUpdate(updatedBlock);
              }}
              onInsert={(index) => {
                const fallback: Block = {
                  type: 'text',
                  content: { value: 'Nested block...' },
                  _id: crypto.randomUUID(),
                };
                const items = [...normalizedItems];
                items.splice(index, 0, fallback);
                const updatedBlock = {
                  ...block,
                  content: {
                    ...block.content,
                    items,
                  },
                };
                handleNestedBlockUpdate(updatedBlock);
              }}
            />
          ) : (
            <div className={`grid grid-cols-${columns} gap-4`}>
              {normalizedItems.map((b, i) => (
                <RenderBlock key={i} block={b} />
              ))}
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
