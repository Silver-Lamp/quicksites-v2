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
      return (
        <p className="mb-4 text-base text-gray-900 dark:text-gray-100">
          {block.content?.value}
        </p>
      );

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
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {block.content.caption}
            </p>
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
        <blockquote className="border-l-4 pl-4 italic text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 mb-4">
          “{block.content?.text}”
          {block.content?.attribution && (
            <footer className="mt-1 text-sm text-right text-gray-500 dark:text-gray-400">
              — {block.content.attribution}
            </footer>
          )}
        </blockquote>
      );

    case 'button': {
      const styleClass =
        block.content?.style === 'ghost'
          ? 'bg-transparent border border-gray-300 text-gray-800 dark:text-gray-100'
          : block.content?.style === 'secondary'
          ? 'bg-gray-600 hover:bg-gray-700 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white';

      return (
        <a
          href={block.content?.href}
          className={`inline-block px-4 py-2 rounded text-sm mb-4 transition ${styleClass}`}
        >
          {block.content?.label}
        </a>
      );
    }

    case 'grid': {
      const normalizedItems = block.content?.items?.map(normalizeBlock) || [];
      const gridLabel = handleNestedBlockUpdate ? 'Grid (drag enabled)' : 'Grid (static)';
      const columns = block.content?.columns || 1;

      return (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs italic text-gray-600 dark:text-gray-400">
              {gridLabel}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
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
        <section className="mb-8 text-center bg-white text-gray-900 dark:bg-neutral-900 dark:text-white">
          <h1 className="text-3xl font-bold mb-2">{block.content?.title}</h1>
          {block.content?.description && (
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {block.content.description}
            </p>
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
        <div className="mb-6 bg-white text-gray-900 dark:bg-neutral-900 dark:text-white">
          <h3 className="text-xl font-semibold mb-2">Our Services</h3>
          <ul className="grid gap-2 list-disc list-inside">
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
        <div className="mb-6 border-l-4 pl-4 border-blue-500 text-gray-800 dark:text-gray-200 italic bg-white dark:bg-neutral-900">
          “{block.content?.quote}”
          {block.content?.attribution && (
            <footer className="mt-2 text-sm text-blue-600 dark:text-blue-300">
              — {block.content.attribution}
            </footer>
          )}
        </div>
      );

    default: {
      const _exhaustiveCheck: never = block;
      return (
        <div className="mb-4 text-yellow-700 dark:text-yellow-300 italic">
          Block type <code>{(block as any).type}</code> not implemented.
        </div>
      );
    }
  }
}
