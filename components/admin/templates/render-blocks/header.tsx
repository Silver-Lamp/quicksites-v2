// components/admin/templates/render-blocks/header.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import { Menu, X } from 'lucide-react';

type NavItem = { label: string; href: string; appearance?: string };

type Props = {
  block?: Block;
  content?: Block['content'];
  template?: Template;
  colorMode?: 'light' | 'dark';
  previewOnly?: boolean;
  device?: 'mobile' | 'tablet' | 'desktop';
};

function normalizeContent(block?: Block, override?: any) {
  const src = (override ?? block?.content ?? {}) as any;
  const logo_url: string =
    src.logo_url ??
    src.logoUrl ??
    (block as any)?.props?.logo_url ??
    (block as any)?.props?.logoUrl ??
    '';

  const raw =
    (Array.isArray(src.nav_items) && src.nav_items) ||
    (Array.isArray(src.navItems) && src.navItems) ||
    (Array.isArray((block as any)?.props?.nav_items) && (block as any).props.nav_items) ||
    [];

  const nav: NavItem[] = raw
    .map((l: any) => ({
      label: typeof l?.label === 'string' ? l.label : '',
      href: typeof l?.href === 'string' ? l.href : '',
      appearance: typeof l?.appearance === 'string' ? l.appearance : 'default',
    }))
    .filter((l: NavItem) => l.label && l.href);

  return { logo_url, nav };
}

function useMediaQuery(q: string) {
  const [match, setMatch] = React.useState(false);
  React.useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return match;
}

export default function HeaderRender({
  block,
  content,
  template,
  colorMode = 'dark',
  previewOnly = false,
  device,
}: Props) {
  const meta = (template?.data as any)?.meta ?? {};
  const fallLogo = typeof meta?.logo_url === 'string' ? meta.logo_url : (template as any)?.logo_url;
  const { logo_url, nav } = React.useMemo(
    () => {
      const base = normalizeContent(block, content);
      return { logo_url: base.logo_url || fallLogo || '', nav: base.nav };
    },
    [block, content, fallLogo]
  );

  const forceNarrow = device === 'mobile' || device === 'tablet';
  const isMdUp = useMediaQuery('(min-width: 768px)');

  const [menuOpen, setMenuOpen] = React.useState(false);

  // Close menu when truly on desktop width; do NOT auto-close just because device prop is missing.
  React.useEffect(() => {
    if (isMdUp && menuOpen) setMenuOpen(false);
  }, [isMdUp, menuOpen]);

  const bg = colorMode === 'light' ? 'bg-white text-gray-900' : 'bg-neutral-950 text-white';
  const border = colorMode === 'light' ? 'border-gray-200' : 'border-white/10';
  const linkBase =
    colorMode === 'light'
      ? 'text-gray-900 hover:text-gray-700'
      : 'text-white/90 hover:text-white';

  const maybePrevent = previewOnly
    ? { onClick: (e: React.MouseEvent<HTMLAnchorElement>) => e.preventDefault(), tabIndex: -1 }
    : {};

  return (
    <header className={`${bg}`} data-device={device || 'auto'}>
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          {logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo_url}
              alt="Logo"
              className="h-10 w-auto rounded-md bg-white/5 object-contain"
            />
          ) : (
            <div className="h-10 w-10 rounded-md bg-white/10" aria-hidden />
          )}
        </div>

        {/* Desktop nav (mount only when not forcing narrow) */}
        {!forceNarrow && (
          <nav className="hidden md:flex items-center gap-6">
            {nav.map((item, i) => (
              <Link
                key={`${item.href}-${i}`}
                href={previewOnly ? '#' : item.href}
                className={linkBase + ' text-sm font-medium'}
                {...maybePrevent}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Hamburger button */}
        {forceNarrow ? (
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/10 hover:bg-white/15"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        ) : (
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/10 hover:bg-white/15 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}
      </div>

      {/* Mobile menu: show only when menuOpen; when forcing narrow, do NOT include md:hidden so desktop width can't hide it */}
      {menuOpen && (
        <div className={`${forceNarrow ? '' : 'md:hidden'} border-t border-white/10`}>
          <nav className="mx-auto max-w-6xl px-4 py-3 grid gap-2">
            {nav.length ? (
              nav.map((item, i) => (
                <a
                  key={`${item.href}-${i}`}
                  href={previewOnly ? '#' : item.href}
                  className={`${linkBase} block rounded px-2 py-1.5`}
                  onClick={(e) => {
                    if (previewOnly) e.preventDefault();
                    setMenuOpen(false);
                  }}
                  {...maybePrevent}
                >
                  {item.label}
                </a>
              ))
            ) : (
              <span className="text-white/60 text-sm">No links configured.</span>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
