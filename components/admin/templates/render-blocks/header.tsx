'use client';

import type { Block } from '@/types/blocks';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

type Props = {
  /** The header block to render (may be null/undefined if not set) */
  block: Block | null | undefined;
  /** Disable interactive bits (e.g., hamburger) in preview-only contexts */
  previewOnly?: boolean;
  /** Force light/dark text/background styles */
  colorMode?: 'light' | 'dark';
  /** When true, shows editor chrome (hover Edit button) */
  showEditorChrome?: boolean;
  /** Open your block editor; receives the resolved header block */
  onEdit?: (b: Block) => void;
  /** Optional extra classes for the outermost wrapper */
  className?: string;
};

export default function PageHeader({
  block,
  previewOnly = false,
  colorMode = 'dark',
  showEditorChrome = false,
  onEdit,
  className = '',
}: Props) {
  // Guard + normalize: allow rendering even if block missing or wrong type
  const hdr: Block | null =
    block && block.type === 'header'
      ? block
      : (block && (block as any).type === undefined
          ? ({ ...block, type: 'header' } as Block)
          : null);

  const content = ((hdr?.content ?? {}) as any) || {};

  // Accept both camelCase and snake_case; also a generic "links" fallback
  const logoUrl: string = content.logo_url || content.logoUrl || '';
  const navItems: Array<{ href?: string; label?: string; appearance?: string }> =
    content.nav_items || content.navItems || content.links || [];

  const [menuOpen, setMenuOpen] = useState(false);

  const isLight = colorMode === 'light';
  const textColor = isLight ? 'text-gray-900' : 'text-white';
  const hoverColor = isLight ? 'hover:text-blue-600' : 'hover:text-yellow-400';
  const bgColor = isLight ? 'bg-white' : 'bg-neutral-950';
  const borderChrome = showEditorChrome ? 'hover:border-white/15 border border-transparent' : '';

  return (
    <header
      className={`relative group w-full ${bgColor} ${textColor} ${borderChrome} ${className}`}
      data-site-header
      data-block-id={hdr?._id || 'site-header'}
      aria-label="Site header"
    >
      {/* Editor chrome: hover “Edit Header” button */}
      {showEditorChrome && hdr && (
        <button
          type="button"
          className="pointer-events-auto absolute right-2 top-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity text-xs rounded-md bg-black/60 hover:bg-black text-white px-2 py-1"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(hdr);
          }}
        >
          Edit Header
        </button>
      )}

      <div className="w-full mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
        {/* Logo */}
        {logoUrl ? (
          <Link href="/" className="flex items-center shrink-0" aria-label="Home" data-editor-logo>
            <Image
              src={logoUrl}
              alt="Site Logo"
              width={60}
              height={60}
              className="h-[60px] w-auto rounded shrink-0"
              priority
            />
          </Link>
        ) : (
          <div className="shrink-0" /> 
        )}

        {/* Desktop nav */}
        <nav className="hidden md:flex md:flex-1 min-w-0 items-center
               gap-6 text-sm font-medium justify-center
               overflow-x-auto whitespace-nowrap">
          {Array.isArray(navItems) &&
            navItems.map((item, i) => (
              <Link
                key={`${item.href ?? '#'}-${i}`}
                href={item.href ?? '#'}
                className={`transition-colors duration-200 ${textColor} ${hoverColor} ${item.appearance ?? ''}`}
              >
                {item.label ?? 'Link'}
              </Link>
            ))}
        </nav>

        {/* Hamburger icon (mobile) */}
        {!previewOnly ? (
          <button
            className={`md:hidden ${textColor} shrink-0`}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        ) : (
          <div className={`md:hidden ${textColor} opacity-50 shrink-0`}>
            <Menu size={24} />
          </div>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && !previewOnly && (
        <div className={`${bgColor} px-4 pb-4 space-y-2 text-sm font-medium`}>
          {Array.isArray(navItems) &&
            navItems.map((item, i) => (
              <Link
                key={`${item.href ?? '#'}-m-${i}`}
                href={item.href ?? '#'}
                className={`block transition-colors duration-200 ${textColor} ${hoverColor} ${item.appearance ?? ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label ?? 'Link'}
              </Link>
            ))}
        </div>
      )}
    </header>
  );
}
