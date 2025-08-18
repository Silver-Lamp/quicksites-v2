'use client';

import { useEffect, useRef, useState } from 'react';

function stripScripts(html: string) {
  // Remove any <script>…</script> blocks for safety
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

export default function HeadPreview({ headHtml }: { headHtml: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState('');

  useEffect(() => {
    const safeHead = stripScripts(headHtml || '');
    const content = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <base href="/" />
    ${safeHead}
    <style>
      :root { color-scheme: light; }
      html,body { margin:0; padding:0; font: 13px/1.45 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .wrap { padding: 12px 14px; }
      h1 { margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #111; }
      .hint { color:#666; font-size:12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Meta Preview</h1>
      <div class="hint">This frame renders your <code>&lt;head&gt;</code> tags with a light background.</div>
    </div>
  </body>
</html>`;
    setSrcDoc(content);
  }, [headHtml]);

  return (
    <div className="border border-white/10 rounded mt-4 overflow-hidden">
      <iframe
        ref={ref}
        title="Head Preview"
        srcDoc={srcDoc}
        // sandbox with no flags => scripts disabled, no top-nav, etc.
        sandbox=""
        loading="lazy"
        className="w-full h-40 bg-white"
      />
    </div>
  );
}
