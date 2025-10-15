// (same as canvas; omitted here for brevity)
'use client';

import * as React from 'react';
import QRCode from 'react-qr-code';

type Props = {
  longUrl: string;
  shortUrl?: string;
  caption?: string;
  size?: number; // 64–512
  align?: 'left' | 'center' | 'right';
  showLinkText?: boolean;
};

function hostPath(u: string) {
  try { const x = new URL(u); return (x.host + x.pathname).replace(/\/$/, ''); }
  catch { return u; }
}

export function PublicQrInfoBlock({ content }: { content: Props }) {
  const url = content.shortUrl || content.longUrl;
  const justify =
    content.align === 'left' ? 'items-start'
      : content.align === 'right' ? 'items-end'
      : 'items-center';
  const linkText = hostPath(url);

  const requested = Number(content.size);
  const size = Number.isFinite(requested)
    ? Math.max(64, Math.min(512, requested))
    : 120; // <- hard default


  return (
    <section className={`mx-auto max-w-5xl px-4 py-8 flex ${justify}`}>
      <div className="inline-flex flex-col items-center gap-2 max-w-[180px]">
        <div
            className="rounded-xl border bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
            style={{ width: size, height: size }}
            >
            <QRCode value={url} size={size} style={{ width: '100%', height: '100%' }} />
        </div>
        {content.caption && (
          <div className="text-xs text-gray-600 dark:text-gray-400">{content.caption}</div>
        )}
        {content.showLinkText !== false && (
          <Copyable text={linkText} />
        )}
      </div>
    </section>
  );
}

function Copyable({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  async function onCopy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false), 900); } catch {}
  }
  return (
    <button onClick={onCopy} className="group inline-flex items-center gap-2 text-xs text-indigo-600 hover:underline dark:text-indigo-300">
      <span className="truncate max-w-[260px]">{text}</span>
      <span className="opacity-70 group-hover:opacity-100">{copied ? 'Copied ✓' : 'Copy'}</span>
    </button>
  );
}
