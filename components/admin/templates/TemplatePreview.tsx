import type { TemplateData } from '@/types/template';
import type { Block } from '@/types/blocks';

type TemplatePreviewProps = {
  data: TemplateData;
  colorScheme?: string;
  theme?: string;
  brand?: string;
  onBlockClick?: (block: Block) => void;
};

export default function TemplatePreview({
  data,
  colorScheme,
  theme,
  brand,
  onBlockClick,
}: TemplatePreviewProps) {
  return (
    <div className={`preview-block bg-${colorScheme || 'gray'}-100 p-4`}>
      <div className="mb-4 text-sm text-gray-500">
        {theme && (
          <>
            Theme: <strong>{theme}</strong> ·{' '}
          </>
        )}
        {brand && (
          <>
            Brand: <strong>{brand}</strong>
          </>
        )}
      </div>
      {data.pages.map((page, pageIndex) => (
        <div key={page.slug || `page-${pageIndex}`} className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Page: {page.slug}</h2>
          {page.content_blocks.map((block) => (
            <div
              key={block.id}
              className="border p-2 mb-2 bg-white shadow-sm"
              onClick={() => onBlockClick?.(block)}
            >
              <strong>{block.type}</strong>
              <pre className="text-xs mt-1 text-gray-600">
                {JSON.stringify(block.content, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
