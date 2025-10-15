// (same as canvas; omitted here for brevity)
'use client';

import * as React from 'react';
import QRCode from 'react-qr-code';

type Props = {
  longUrl: string;
  shortUrl?: string;
  caption?: string;
  size?: number;               // 80–220
  side?: 'left' | 'right';
  sticky?: boolean;
  topOffsetPx?: number;
  hideOnMobile?: boolean;
  breakpoint?: 'md' | 'lg' | 'xl';
  widthPx?: number;
};

function hostPath(u: string) {
  try { const x = new URL(u); return (x.host + x.pathname).replace(/\/$/, ''); }
  catch { return u; }
}

export function PublicQrSidebarBlock({ content }: { content: Props }) {
  const url = content.shortUrl || content.longUrl;
  const linkText = hostPath(url);

  const bp = content.breakpoint ?? 'lg';
  const hideClass = content.hideOnMobile !== false ? `hidden ${bp}:block` : '';
  const justify = content.side === 'left' ? 'justify-start' : 'justify-end';

  const style: React.CSSProperties = {
    width: `${content.widthPx ?? 260}px`,
    top: (content.sticky ?? true) ? `${content.topOffsetPx ?? 24}px` : undefined,
  };
  const requested = Number(content.size);
  const size = Number.isFinite(requested)
    ? Math.max(80, Math.min(220, requested))
    : 128;

  return (
    <aside className={`mx-auto max-w-6xl px-4 ${hideClass}`}>
      <div className={`w-full flex ${justify}`}>
        <div className={`${content.sticky ?? true ? 'sticky' : ''} self-start`} style={style}>
          <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-col items-center gap-2">
                <div className="rounded-xl border bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
                    style={{ width: size, height: size }}>
                <QRCode value={url} size={size} style={{ width: '100%', height: '100%' }} />
                </div>              
                {content.caption && (
                <div className="text-xs text-gray-600 dark:text-gray-400">{content.caption}</div>
              )}
              <Copyable text={linkText} />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Copyable({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  async function onCopy() { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false), 900); } catch {} }
  return (
    <button onClick={onCopy} className="group inline-flex items-center gap-2 text-xs text-indigo-600 hover:underline dark:text-indigo-300">
      <span className="truncate max-w-[240px]">{text}</span>
      <span className="opacity-70 group-hover:opacity-100">{copied ? 'Copied ✓' : 'Copy'}</span>
    </button>
  );
}
