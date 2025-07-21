'use client';

import { useState } from 'react';

export default function FaviconHeadSnippet({
  basePath,
  showPreview = true,
}: {
  basePath: string;
  showPreview?: boolean;
}) {
  const [useIco, setUseIco] = useState(false);

  const iconHref = useIco
    ? `${basePath}/favicon.ico`
    : `${basePath}/favicon.png`;

  return (
    <div className="text-sm text-white/80 mt-4 space-y-2">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={useIco}
          onChange={(e) => setUseIco(e.target.checked)}
        />
        Use .ico instead of .png
      </label>

      <pre className="bg-neutral-800 p-3 rounded border border-white/10 text-xs whitespace-pre-wrap">
{`<link rel="icon" href="${iconHref}">
<link rel="apple-touch-icon" sizes="180x180" href="${basePath}/favicon.png">`}
      </pre>

      {showPreview && (
        <div className="flex gap-4 pt-2 items-end">
          <img src={iconHref} alt="Favicon" width={48} height={48} />
          <span className="text-xs text-white/40">Favicon Preview</span>
        </div>
      )}
    </div>
  );
}
