'use client';

import * as React from 'react';
import QRCode from 'react-qr-code';
import {
  downloadDataUrl,
  downloadTextAsFile,
  getSvgStringFromNode,
  sanitizeFilename,
  svgStringToPngDataUrl,
} from '@/lib/qr/util';

type Props = {
  value: string;
  /** Size of the on-page preview (default 128px) */
  previewSize?: number;
  /** Size of the exported PNG (default 1024px) */
  exportSize?: number;
  bg?: string;
  fileBaseName?: string;
  className?: string;
};

export default function DownloadQR({
  value,
  previewSize = 128,     // ⬅️ small on-page preview
  exportSize = 1024,      // ⬅️ large crisp export
  bg = '#ffffff',
  fileBaseName = 'qr',
  className,
}: Props) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const base = sanitizeFilename(fileBaseName, 'qr');

  async function handleDownloadSvg() {
    if (!svgRef.current) return;
    const svgString = getSvgStringFromNode(svgRef.current);
    downloadTextAsFile(`${base}.svg`, svgString);
  }

  async function handleDownloadPng() {
    if (!svgRef.current) return;
    const svgString = getSvgStringFromNode(svgRef.current);
    // ⬇️ generate high-res PNG regardless of the preview size
    const dataUrl = await svgStringToPngDataUrl(svgString, exportSize, bg);
    downloadDataUrl(`${base}.png`, dataUrl);
  }

  return (
    <div className={className}>
      <div className="inline-flex flex-col items-center gap-3">
        <div
          className="rounded-xl border bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
          style={{ width: previewSize, height: previewSize }}
        >
          <QRCode
            value={value}
            size={previewSize}
            ref={(node: SVGSVGElement | null) => (svgRef.current = node)}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        <div className="flex w-full flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Download SVG
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-gray-900"
          >
            Download PNG
          </button>
        </div>
      </div>
    </div>
  );
}
