// components/ui/image-url-preview.tsx
'use client';

import * as React from 'react';

export default function ImageUrlPreview({
  url,
  onClear,
  className = '',
}: {
  url?: string;
  onClear?: () => void;
  className?: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dims, setDims] = React.useState<{ w: number; h: number } | null>(null);

  React.useEffect(() => {
    if (!url) { setLoading(false); setError(null); setDims(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDims(null);

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (cancelled) return;
      setLoading(false);
      setDims({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      if (cancelled) return;
      setLoading(false);
      setError('Failed to load image');
    };
    img.src = url;

    return () => { cancelled = true; };
  }, [url]);

  return (
    <div className={`mt-2 rounded-lg border p-2 ${className}`}>
      {!url ? (
        <p className="text-xs text-muted-foreground">
          Paste a URL or click “Generate with OpenAI” to see a preview.
        </p>
      ) : (
        <div className="flex items-start gap-3">
          <div className="h-24 w-40 overflow-hidden rounded-md bg-muted grid place-items-center">
            {loading ? (
              <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
                aria-label="Loading"
              />
            ) : error ? (
              <div className="text-[11px] text-red-600 px-2 text-center">{error}</div>
            ) : (
              // use <img> so we don't need to allow-list domains in next.config
              <img src={url} alt="" className="h-full w-full object-cover" />
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <div className="font-medium text-foreground break-all max-w-[36ch]">
              {url}
            </div>
            <div>
              {dims ? `${dims.w} × ${dims.h}px` : loading ? 'Loading…' : error ? 'Error' : '—'}
            </div>
            <div className="space-x-2">
              <a className="underline" href={url} target="_blank" rel="noreferrer">Open</a>
              {onClear && (
                <button type="button" className="underline" onClick={onClear}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
