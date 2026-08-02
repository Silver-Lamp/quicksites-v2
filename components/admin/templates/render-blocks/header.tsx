// components/admin/templates/render-blocks/header.tsx
'use client';

import { isEditorContext } from '@/lib/editor/isEditorContext';

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
  /** If true, links shouldn't navigate (used in preview/editor) */
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

/**
 * Point nav items at things that exist, and drop the ones that don't.
 *
 * ⚠️ 83 OF 98 LIVE SITES — 85% — SHIPPED NAV LINKS TO PAGES THAT DO NOT EXIST. The scaffold
 * seeds `/services` and `/contact` regardless of whether those pages were ever created, and
 * almost no site creates them: the services list and the contact form are BLOCKS on the single
 * index page, not separate routes. So the two most prominent links in the header of most sites
 * we host went nowhere.
 *
 * It compounds with the tenant soft-404 (an unknown path returns 200 with 404 content), so those
 * dead links are also indexable. Found while polishing one custom site and looking at the header.
 *
 * The fix is not to hide them — the destination usually EXISTS, as a block. So:
 *   1. a real page at that path  → leave it alone
 *   2. a matching block on the page → rewrite to an in-page anchor, which is what the visitor wanted
 *   3. neither → drop the item, because a link to nothing is worse than one fewer link
 *
 * Renderer-side on purpose: it repairs every already-published site on deploy, with no data
 * migration and nothing for an owner to re-save.
 */
function resolveNav(nav: NavItem[], template?: Template): NavItem[] {
  const data: any = (template as any)?.data ?? {};
  const pages: any[] = Array.isArray(data.pages) ? data.pages : [];

  const pagePaths = new Set<string>(['/']);
  for (const p of pages) {
    if (typeof p?.slug === 'string' && p.slug) pagePaths.add(p.slug === 'index' ? '/' : `/${p.slug}`);
  }

  const blockTypes = new Set<string>(
    pages.flatMap((p: any) => [...(p?.content_blocks ?? []), ...(p?.blocks ?? [])]).map((b: any) => b?.type),
  );

  /** Which block type would satisfy a link to this path. */
  const ANCHOR_FOR: Record<string, string[]> = {
    '/services': ['services'],
    '/contact': ['contact_form'],
    '/menu': ['menu'],
    '/faq': ['faq'],
    '/about': ['story'],
  };

  return nav.flatMap((item) => {
    const href = item.href;
    // External, anchors, tel/mailto — not ours to judge.
    if (!href.startsWith('/') || href.startsWith('/#')) return [item];
    if (pagePaths.has(href)) return [item];

    const wanted = ANCHOR_FOR[href] ?? [];
    if (wanted.some((t) => blockTypes.has(t))) {
      return [{ ...item, href: `/#${href.slice(1)}` }];
    }
    return [];
  });
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
  const fallLogo =
    typeof meta?.logo_url === 'string' ? meta.logo_url : (template as any)?.logo_url;

  // No-logo fallback: the business name as a text wordmark. A site without a logo
  // (restaurants default to none — their branding is theirs, not ours to invent)
  // should read as THEIR name, not an empty gray placeholder square.
  const wordmark: string =
    (template as any)?.business_name ||
    meta?.business_name ||
    meta?.identity?.business_name ||
    (template as any)?.template_name ||
    '';

  const { logo_url, nav } = React.useMemo(() => {
    const base = normalizeContent(block, content);
    // Resolve before render: dead links become anchors where the section exists, and disappear
    // where it doesn't. See resolveNav — this was 85% of live sites.
    return { logo_url: base.logo_url || fallLogo || '', nav: resolveNav(base.nav, template) };
  }, [block, content, fallLogo, template]);

  // We consider ourselves "in editor" if inside an iframe OR previewOnly is true
  const inIframe =
    typeof window !== 'undefined' &&
    typeof window.parent !== 'undefined' &&
    window.parent !== window;
  const enableHeaderEdit = inIframe || previewOnly;

  const forceNarrow = device === 'mobile' || device === 'tablet';
  const isMdUp = useMediaQuery('(min-width: 768px)');

  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (isMdUp && menuOpen) setMenuOpen(false);
  }, [isMdUp, menuOpen]);

  const bg = 'bg-card text-card-foreground border-b border-border';
  const linkBase = 'text-foreground/80 hover:text-foreground';

  const maybePreventLink = enableHeaderEdit
    ? {
        onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
          e.stopPropagation();
        },
        tabIndex: -1,
      }
    : previewOnly
      ? { onClick: (e: React.MouseEvent<HTMLAnchorElement>) => e.preventDefault(), tabIndex: -1 }
      : {};

  const openHeaderEditor = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!enableHeaderEdit) return;
      e.stopPropagation();
      try {
        window.parent?.postMessage({ type: 'qs:edit-header' }, '*');
      } catch {
        /* no-op */
      }
    },
    [enableHeaderEdit]
  );

  // Home link target = base of current host
  const homeHref = '/';

  return (
    <header
      className={`${bg}`}
      data-device={device || 'auto'}
      data-qseditor-header={enableHeaderEdit ? '1' : undefined}
      onClick={enableHeaderEdit ? openHeaderEditor : undefined}
      title={enableHeaderEdit ? 'Click to edit header' : undefined}
      style={enableHeaderEdit ? { cursor: 'pointer' } : undefined}
    >
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        {/* Logo (navigates home on live site; suppressed in editor/preview) */}
        <div className="flex items-center gap-3" onClick={enableHeaderEdit ? (e) => e.stopPropagation() : undefined}>
          {logo_url ? (
            enableHeaderEdit ? (
              // Editor/preview: no navigation, still clickable area to open editor (handled on header)
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo_url}
                alt="Logo"
                className="h-10 w-auto rounded-md bg-muted object-contain"
              />
            ) : (
              <Link href={homeHref} aria-label="Home" prefetch={false}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo_url}
                  alt="Logo"
                  className="h-10 w-auto rounded-md bg-muted object-contain"
                />
              </Link>
            )
          ) : wordmark ? (
            enableHeaderEdit ? (
              <span className="text-lg font-semibold tracking-tight text-foreground">{wordmark}</span>
            ) : (
              <Link
                href={homeHref}
                aria-label="Home"
                prefetch={false}
                className="text-lg font-semibold tracking-tight text-foreground hover:opacity-80"
              >
                {wordmark}
              </Link>
            )
          ) : (
            enableHeaderEdit ? (
              <div className="h-10 w-10 rounded-md bg-muted" aria-hidden />
            ) : (
              <Link href={homeHref} aria-label="Home" prefetch={false}>
                <div className="h-10 w-10 rounded-md bg-muted" aria-hidden />
              </Link>
            )
          )}
        </div>

        {/* Desktop nav */}
        {!forceNarrow && (
          <nav
            className="hidden md:flex items-center gap-6"
            onClick={enableHeaderEdit ? (e) => e.stopPropagation() : undefined}
          >
            {nav.map((item, i) => (
              <Link
                key={`${item.href}-${i}`}
                href={previewOnly ? '#' : item.href}
                className={linkBase + ' text-sm font-medium'}
                {...maybePreventLink}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Hamburger */}
        {forceNarrow ? (
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-muted hover:bg-muted/70"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        ) : (
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-muted hover:bg-muted/70 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className={`${forceNarrow ? '' : 'md:hidden'} border-t border-border`}
          onClick={enableHeaderEdit ? (e) => e.stopPropagation() : undefined}
        >
          <nav className="mx-auto max-w-6xl px-4 py-3 grid gap-2">
            {nav.length ? (
              nav.map((item, i) => (
                <a
                  key={`${item.href}-${i}`}
                  href={previewOnly ? '#' : item.href}
                  className={`${linkBase} block rounded px-2 py-1.5`}
                  onClick={(e) => {
                    if (enableHeaderEdit || previewOnly) e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
                  }}
                >
                  {item.label}
                </a>
              ))
            ) : (
              // Editor-only: a visitor should see an empty nav, not a setup instruction.
              isEditorContext() ? (
                <span className="text-muted-foreground text-sm">No links configured.</span>
              ) : null
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
