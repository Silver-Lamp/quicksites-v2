// components/admin/templates/render-blocks/header.tsx
'use client';

import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Menu, X } from 'lucide-react';

type Props = {
  /** The header block to render (may be null/undefined if not set) */
  block: Block | null | undefined;
  /** Optional template to read meta-first logo/title */
  template?: Template;
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

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}
function normalizeHref(href?: string | null) {
  const raw = String(href ?? '').trim();
  if (!raw) return '#';
  return raw;
}

export default function PageHeader({
  block,
  template,
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

  // ---- meta-first logo + title fallbacks ----
  const meta = (template?.data as any)?.meta ?? {};
  const logoUrl: string =
    String(content.logo_url || content.logoUrl || '') ||
    String(meta.logo_url || (template as any)?.logo_url || '');

  const siteTitle: string =
    (typeof meta.siteTitle === 'string' && meta.siteTitle.trim()) ||
    (template?.template_name as string) ||
    'Site';

  // Accept both snake/camel and a generic "links" fallback
  const navItems: Array<{ href?: string; label?: string; appearance?: string }> =
    (Array.isArray(content.nav_items) && content.nav_items) ||
    (Array.isArray(content.navItems) && content.navItems) ||
    (Array.isArray(content.links) && content.links) ||
    [];

  const [menuOpen, setMenuOpen] = useState(false);

  const isLight = colorMode === 'light';
  const textColor = isLight ? 'text-gray-900' : 'text-white';
  const hoverColor = isLight ? 'hover:text-blue-600' : 'hover:text-yellow-400';
  const bgColor = isLight ? 'bg-white' : 'bg-neutral-950';
  const borderChrome = showEditorChrome ? 'hover:border-white/15 border border-transparent' : '';

  // Pre-normalize items for both desktop & mobile
  const items = useMemo(() => {
    return (navItems || []).map((it, i) => {
      const href = normalizeHref(it?.href);
      const label = (it?.label ?? '').trim() || 'Link';
      const appearance = it?.appearance ?? '';
      const external = isExternal(href);
      return { key: `${href}-${i}`, href, label, appearance, external };
    });
  }, [navItems]);

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
        {/* Logo / Title */}
        <Link href="/" className="flex items-center gap-3 shrink-0" aria-label="Home" data-editor-logo>
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={siteTitle ? `${siteTitle} logo` : 'Site Logo'}
              width={60}
              height={60}
              className="h-[60px] w-auto rounded shrink-0 object-contain"
              priority
            />
          ) : (
            <span className={`text-base font-semibold ${textColor}`}>{siteTitle}</span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav
          className="hidden md:flex md:flex-1 min-w-0 items-center
               gap-6 text-sm font-medium justify-center
               overflow-x-auto whitespace-nowrap"
          aria-label="Primary"
        >
          {items.map((item) =>
            item.external ? (
              <a
                key={item.key}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`transition-colors duration-200 ${textColor} ${hoverColor} ${item.appearance}`}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.key}
                href={item.href}
                className={`transition-colors duration-200 ${textColor} ${hoverColor} ${item.appearance}`}
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        {/* Hamburger icon (mobile) */}
        {!previewOnly ? (
          <button
            className={`md:hidden ${textColor} shrink-0`}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
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
        <div id="mobile-menu" className={`${bgColor} px-4 pb-4 space-y-2 text-sm font-medium`} role="dialog" aria-label="Mobile menu">
          {items.map((item) =>
            item.external ? (
              <a
                key={`${item.key}-m`}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`block transition-colors duration-200 ${textColor} ${hoverColor} ${item.appearance}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={`${item.key}-m`}
                href={item.href}
                className={`block transition-colors duration-200 ${textColor} ${hoverColor} ${item.appearance}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            )
          )}
        </div>
      )}
    </header>
  );
}
