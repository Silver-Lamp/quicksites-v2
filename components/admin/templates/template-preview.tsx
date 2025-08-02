'use client';

import type { TemplateData } from '@/types/template';
import type { Block } from '@/types/blocks';
import RenderBlock from './render-block';
import { normalizePageBlocks } from '@/lib/utils/normalizePageBlocks';

type TemplatePreviewProps = {
  data: TemplateData;
  colorScheme?: string;
  theme?: string;
  brand?: string;
  mode: 'light' | 'dark'; // 🔥 used only for remount key
  onBlockClick?: (block: Block) => void;
  showJsonFallback?: boolean;
  colorMode?: 'light' | 'dark';
};

const bgColorMap: Record<string, string> = {
  gray: 'bg-gray-100',
  slate: 'bg-slate-100',
  blue: 'bg-blue-100',
  red: 'bg-red-100',
  green: 'bg-green-100',
  yellow: 'bg-yellow-100',
};

export default function TemplatePreview({
  data,
  colorScheme = 'gray',
  theme,
  brand,
  onBlockClick,
  showJsonFallback = false,
  mode,
  colorMode = 'light',
}: TemplatePreviewProps) {
  const previewBg = bgColorMap[colorScheme] || 'bg-gray-100';

  return (
    <div
      key={`preview-${mode}`} // 🔄 force remount on theme switch
      className={`
        preview-block \${previewBg}
        bg-white text-gray-900
        dark:bg-neutral-900 dark:text-white
        border border-gray-200 dark:border-neutral-700
        p-6 rounded-lg
        transition-colors
      `}
    >
      {(theme || brand) && (
        <div className="mb-4 text-sm text-gray-700 dark:text-gray-300">
          Theme: <strong>{theme || 'none'}</strong> · Brand: <strong>{brand || 'none'}</strong>
        </div>
      )}

      {data.pages.map((page, pageIndex) => {
        const normalizedPage = normalizePageBlocks(page);
        return (
          <div key={normalizedPage.slug || `page-${pageIndex}`} className="mb-10 space-y-6">
            {normalizedPage.slug && (
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                Page: {normalizedPage.slug}
              </h2>
            )}

            {normalizedPage.content_blocks.map((block, i) => (
              <div
                key={block._id ?? `${block.type}-${pageIndex}-${i}`}
                id={`block-${block._id}`}
                onClick={() => onBlockClick?.(block)}
                className={`
                  group rounded-md p-4 transition
                  bg-white text-gray-900 border border-gray-200
                  dark:bg-neutral-800 dark:text-gray-100 dark:border-neutral-700
                  ${onBlockClick ? 'cursor-pointer hover:ring hover:ring-blue-400/30' : ''}
                `}
              >
                <RenderBlock block={block} handleNestedBlockUpdate={onBlockClick} showDebug={false} colorMode={colorMode} />

                {/* {showJsonFallback && (
                  <details className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <summary className="cursor-pointer select-none">Show Raw JSON</summary>
                    <pre className="mt-1 whitespace-pre-wrap break-words">
                      {JSON.stringify(block.content, null, 2)}
                    </pre>
                  </details>
                )} */}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}