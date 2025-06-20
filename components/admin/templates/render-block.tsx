// components/admin/templates/RenderBlock.tsx
import type { Block } from '@/types/block';

export default function RenderBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'text':
      return <p className="mb-4 text-base text-gray-800">{block.value}</p>;

    case 'image':
      return (
        <img
          src={block.value.url}
          alt={block.value.alt}
          className="mb-4 rounded shadow-md max-w-full"
        />
      );

    case 'video':
      return (
        <div className="mb-4">
          <video controls className="max-w-full rounded">
            <source src={block.value.url} />
          </video>
          {block.value.caption && (
            <p className="text-sm text-gray-500 mt-1">{block.value.caption}</p>
          )}
        </div>
      );

    case 'audio':
      return (
        <div className="mb-4">
          <iframe
            className="w-full"
            style={{ height: 80 }}
            src={block.value.url}
            title={block.value.title || block.value.provider}
            allow="autoplay; encrypted-media"
            loading="lazy"
          />
        </div>
      );

    case 'quote':
      return (
        <blockquote className="border-l-4 pl-4 italic text-gray-600 mb-4">
          “{block.value.text}”
          {block.value.author && (
            <footer className="mt-1 text-sm text-right">— {block.value.author}</footer>
          )}
        </blockquote>
      );

    case 'button':
      return (
        <a
          href={block.value.href}
          className={`inline-block px-4 py-2 rounded text-white text-sm mb-4
            ${block.value.style === 'ghost' ? 'bg-transparent border' : block.value.style === 'secondary' ? 'bg-gray-600' : 'bg-blue-600'}`}
        >
          {block.value.label}
        </a>
      );

    case 'grid':
      return (
        <div className={`grid grid-cols-${block.value.columns} gap-4 mb-4`}>
          {block.value.items.map((b, i) => (
            <RenderBlock key={i} block={b} />
          ))}
        </div>
      );

    default:
      return null;
  }
}
