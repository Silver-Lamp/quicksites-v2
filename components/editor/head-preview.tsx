'use client';

import { useEffect, useRef, useState } from 'react';

export default function HeadPreview({ headHtml }: { headHtml: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState('');

  useEffect(() => {
    const content = `<!DOCTYPE html><html><head>${headHtml}</head><body><h1>Meta Preview</h1></body></html>`;
    setSrcDoc(content);
  }, [headHtml]);

  return (
    <div className="border border-white/10 rounded mt-4">
      <iframe ref={ref} title="Head Preview" srcDoc={srcDoc} className="w-full h-40 bg-white" />
    </div>
  );
}
