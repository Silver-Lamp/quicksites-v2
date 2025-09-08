// components/ui/LoadingSplash.tsx
'use client';

import * as React from 'react';

type Props = {
  /** Prefer to pass this if you already have it */
  logoUrl?: string | null;
  /** Or pass the site/template object; we'll read data.meta.logo_url / logo_url */
  template?: any;
  /** Visual tweaks */
  size?: number; // px
  className?: string;
  backdropClassName?: string;
};

function firstString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function resolveLogoFromTemplate(t: any): string | null {
  const meta = t?.data?.meta ?? t?.meta ?? {};
  return (
    firstString(meta.logo_url) ||
    firstString(t?.logo_url) ||
    null
  );
}

function resolveIconFromDocument(): string | null {
  if (typeof document === 'undefined') return null;
  const rels = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
  ];
  for (const sel of rels) {
    const el = document.querySelector(sel) as HTMLLinkElement | null;
    if (el?.href) return el.href;
  }
  return null;
}

export default function LoadingSplash({
  logoUrl,
  template,
  size = 56,
  className = '',
  backdropClassName = '',
}: Props) {
  const [resolved, setResolved] = React.useState<string | null>(() => {
    // Try immediate (template/prop) on first render
    return (
      firstString(logoUrl) ||
      resolveLogoFromTemplate(template) ||
      null
    );
  });

  // As soon as we’re on the client, also consider any <link rel="icon"> tags
  React.useEffect(() => {
    if (!resolved) {
      const fromDom = resolveIconFromDocument();
      if (fromDom) setResolved(fromDom);
    }
  }, [resolved]);

  // Keep in sync if props change
  React.useEffect(() => {
    const next =
      firstString(logoUrl) ||
      resolveLogoFromTemplate(template) ||
      resolved;
    if (next !== resolved) setResolved(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoUrl, template]);

  const boxStyle: React.CSSProperties = {
    height: size,
    width: size,
  };

  return (
    <div
      className={[
        'fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 backdrop-blur-md',
        backdropClassName,
      ].join(' ')}
      aria-live="polite"
      aria-busy="true"
      data-qs="loading-splash"
    >
      <div className={['flex flex-col items-center gap-4', className].join(' ')}>
        {resolved ? (
          <img
            src={resolved}
            // alt="Site logo"
            style={boxStyle}
            className="rounded-2xl bg-white/5 object-contain shadow-sm ring-1 ring-white/10"
            // subtle entrance; respects prefers-reduced-motion by default
          />
        ) : (
          // Fallback skeleton if no logo/icon available
          <div
            style={boxStyle}
            className="rounded-2xl bg-white/10 animate-pulse"
            aria-hidden="true"
          />
        )}
        <div className="text-sm text-white/90">Loading…</div>
      </div>
    </div>
  );
}
