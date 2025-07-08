// components/admin/templates/render-block.tsx
'use client';

import type { Block } from '@/types/blocks';
import SortableGridBlock from './sortable-grid-block';
import { normalizeBlock } from '@/types/blocks';
import { createFallbackBlock } from '@/lib/blocks';

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
                const fallback = createFallbackBlock(block.type);
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
              {normalizedItems.map((b: Block, i: number) => (
                <RenderBlock key={i} block={b} />
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'hero':
  return (
    <section className="mb-8 text-center">
      <h1 className="text-3xl font-bold text-white mb-2">{block.content?.title}</h1>
      {block.content?.description && (
        <p className="text-gray-400 mb-4">{block.content.description}</p>
      )}
      {block.content?.cta_label && block.content?.cta_link && (
        <a
          href={block.content.cta_link}
          className="inline-block px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          {block.content.cta_label}
        </a>
      )}
    </section>
  );

  case 'services':
  return (
    <div className="mb-6">
      <h3 className="text-xl font-semibold text-white mb-2">Our Services</h3>
      <ul className="grid gap-2 list-disc list-inside text-gray-300">
        {block.content?.items?.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );

  case 'cta':
  return (
    <div className="mb-6 text-center">
      <a
        href={block.content?.link}
        className="inline-block px-6 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition"
      >
        {block.content?.label}
      </a>
    </div>
  );

  case 'testimonial':
  return (
    <div className="mb-6 border-l-4 pl-4 border-blue-500 text-gray-200 italic">
      “{block.content?.quote}”
      {block.content?.attribution && (
        <footer className="mt-2 text-sm text-blue-300">
          — {block.content.attribution}
        </footer>
      )}
    </div>
  );

  default: {
    const _exhaustiveCheck: never = block;
    return (
      <div className="mb-4 text-yellow-300 italic">
        Block type <code>{(block as any).type}</code> not implemented.
      </div>
    );
  }
  

    
  }
}
