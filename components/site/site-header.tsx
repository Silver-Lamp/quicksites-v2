// components/site/site-header.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';

// Lazy-load the client CartButton (reads Zustand + snapshot; hides itself when not needed)
const CartButton = dynamic(() => import('@/components/cart/cart-button'), { ssr: false });

type LinkItem = {
  label: string;
  href: string;
  button?: boolean;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  external?: boolean;
  /** Renders as a dropdown on desktop and an indented group in the mobile sheet. */
  children?: LinkItem[];
};

type Props = {
  sticky?: boolean;                 // default: true
  logoSrc?: string;                 // default: '/favicon.ico'
  logoText?: string;                // default: 'QuickSites'
  logoHref?: string;                // default: '/'
  links?: LinkItem[];               // default list below
  className?: string;
};

// ⚠️ FIVE TOP-LEVEL ITEMS, AND THE VERTICALS ARE BEHIND ONE OF THEM (2026-09-25).
//
// This list held ELEVEN flat links. A business owner arriving to answer "is this for me?" had to
// read "Job Seekers", "Lemonade Stands" and "Partners" — three different audiences — before
// reaching Pricing. See docs/AUDIENCE_SPLIT_PLAN.md.
//
// ⚠️ "Partners" is NOT here any more, deliberately. It is in the page footers. A channel partner
// looking for it finds it; a merchant is not sold it on the way to the pricing page. Re-adding it
// to the nav puts the second audience back in front of the first.
const DEFAULT_LINKS: LinkItem[] = [
  { label: 'Features', href: '/features' },
  {
    label: 'Industries',
    href: '/features',
    // Grouped, not deleted. Each of these was a top-level nav item and each still earns its page —
    // the change is that a visitor opens the one that is theirs instead of reading all five.
    children: [
      { label: 'Restaurants', href: '/restaurants' },
      { label: 'Realtors', href: '/realtors' },
      { label: 'Auto Shops', href: '/secondset' },
      { label: 'Supplements', href: '/supplements' },
      // ⚠️ Verbatim was reachable from NOWHERE on this site — zero links from the homepage or nav —
      // while I was citing its usage (8 builds, one owner, one day) as evidence of weak demand. That
      // number measured DISCOVERY, not demand: you cannot conclude nobody wants a feature that nobody
      // can find. Adding the entry point is what turns it into a measurement. It keeps an entry
      // point here for exactly that reason — one level down is still findable; absent is not.
      { label: 'Job Seekers', href: '/verbatim' },
      // The smallest merchant we serve, and the only one who is not the account holder: a kid runs
      // the stand, a grown-up holds the Stripe account (Stripe requires 18+ and verifies identity).
      { label: 'Lemonade Stands', href: '/lemonade-stands' },
    ],
  },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Compare', href: '/compare' },
  // ⚠️ "Book a demo" is the button, not "Contact" — a deliberate change from the plan's sketch.
  // /book is a 20–30 minute guided walkthrough, which is what a business owner evaluating us
  // actually wants and what a rep sends a prospect to. Contact moved to the footers beside
  // Partners; support email is on /contact either way.
  { label: 'Book a demo', href: '/book', button: true, variant: 'ghost' },
];

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

/**
 * Desktop dropdown for a nav item with children.
 *
 * ⚠️ Click-to-open, not hover. A hover menu is unreachable by keyboard and fires by accident on a
 * trackpad; this is a plain button with `aria-expanded`, and it closes on Escape, on an outside
 * click, and whenever the route changes (otherwise it stays open behind the new page).
 */
function NavDropdown({ item, pathname }: { item: LinkItem; pathname: string | null }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const children = item.children ?? [];
  const activeChild = children.some((c) => c.href === pathname);

  React.useEffect(() => setOpen(false), [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex items-center gap-1 text-zinc-300 transition-colors hover:text-white',
          (open || activeChild) && 'text-white'
        )}
      >
        {item.label}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {/* ⚠️ RENDERED ALWAYS, HIDDEN WITH CSS — never `{open && <div>}`.
          These were top-level nav links on every page, i.e. a site-wide internal link to each
          vertical. Mounting the panel only when open removes those anchors from the served HTML
          entirely, so a crawler sees no link to /restaurants, /supplements or /verbatim from
          anywhere. Checked against the actual response, not the source: the first cut of this
          dropdown shipped that regression and `curl | grep` is what found it.
          This is the same failure the DEFAULT_LINKS comment records about Verbatim — reachable from
          nowhere, while its usage was being read as weak demand. `hidden` keeps the links in the
          document and out of the viewport. */}
      <div
        role="menu"
        hidden={!open}
        className={cn(
          'absolute left-0 top-full z-50 mt-2 min-w-48 rounded-lg border border-zinc-800 bg-zinc-950/95 p-1 shadow-xl backdrop-blur',
          !open && 'hidden'
        )}
      >
          {children.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              role="menuitem"
              className={cn(
                'block rounded-md px-3 py-2 text-sm transition-colors',
                pathname === c.href
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
              )}
            >
              {c.label}
            </Link>
          ))}
      </div>
    </div>
  );
}

export default function SiteHeader({
  sticky = true,
  logoSrc = '/qs-default-favicon.ico',
  logoText = 'QuickSites',
  logoHref = '/',
  links = DEFAULT_LINKS,
  className,
}: Props) {
  const pathname = usePathname();

  return (
    <header
      className={cn(
        'border-b border-zinc-800/40',
        sticky && 'sticky top-0 z-40 backdrop-blur bg-black/30',
        className
      )}
    >
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href={logoHref} className="flex items-center gap-2" aria-label={`${logoText} home`}>
          <Image src={logoSrc} alt={logoText} width={24} height={24} className="rounded" />
          <span className="text-sm text-zinc-300">{logoText}</span>
        </Link>

        {/* Desktop nav.
            ⚠️ `lg:` not `md:`. The nav once held eleven flat links, measured ~805px, and overflowed
            horizontally between 768 and ~805px when it switched on at md — found 2026-09-18 against
            foldable widths. It is five items now (2026-09-25), so it is certainly narrower, but
            **I did not re-measure it**, and dropping to `md:` to reclaim a breakpoint nobody asked
            for is how that bug comes back. Left at `lg:` on purpose. */}
        <nav className="hidden lg:flex items-center gap-4 text-sm">
          {links.map((l) =>
            l.children?.length ? (
              <NavDropdown key={l.href + l.label} item={l} pathname={pathname} />
            ) : l.button ? (
              <Link
                key={l.href + l.label}
                href={l.href}
                className="inline-flex"
                target={l.external ? '_blank' : undefined}
                rel={l.external ? 'noopener noreferrer' : undefined}
                aria-label={l.label}
              >
                <Button size="sm" variant={l.variant ?? 'ghost'}>{l.label}</Button>
              </Link>
            ) : (
              <Link
                key={l.href + l.label}
                href={l.href}
                className={cn(
                  'text-zinc-300 hover:text-white transition-colors',
                  pathname === l.href && 'text-white'
                )}
                target={l.external ? '_blank' : undefined}
                rel={l.external ? 'noopener noreferrer' : undefined}
                aria-current={pathname === l.href ? 'page' : undefined}
              >
                {l.label}
              </Link>
            )
          )}

          {/* Divider + Cart (shows only if ecom enabled or cart has items) */}
          <span className="mx-1 h-5 w-px bg-zinc-800/50" />
          <CartButton />
        </nav>

        {/* Mobile menu — must be the exact complement of the nav breakpoint above. */}
        <div className="lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-black/95 border-l border-zinc-800/40">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Image src={logoSrc} alt={logoText} width={20} height={20} className="rounded" />
                  <span>{logoText}</span>
                </SheetTitle>
              </SheetHeader>

              <nav className="mt-6 flex flex-col gap-2">
                {links.map((l) => {
                  const active = pathname === l.href;
                  // ⚠️ A grouped item renders as a LABELLED LIST here, not a dropdown. The sheet is
                  // already a disclosure; nesting a second one inside it hides the verticals behind
                  // two taps on the device where they matter most. Everything stays one tap away.
                  if (l.children?.length) {
                    return (
                      <div key={l.href + l.label} className="mt-1">
                        <div className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                          {l.label}
                        </div>
                        {l.children.map((c) => (
                          <SheetClose asChild key={c.href}>
                            <Link
                              href={c.href}
                              className={cn(
                                'block rounded-md px-3 py-2 text-sm transition-colors',
                                pathname === c.href
                                  ? 'bg-zinc-800 text-white'
                                  : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                              )}
                              aria-current={pathname === c.href ? 'page' : undefined}
                            >
                              {c.label}
                            </Link>
                          </SheetClose>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <SheetClose asChild key={l.href + l.label}>
                      {l.button ? (
                        <Link
                          href={l.href}
                          className="inline-flex"
                          target={l.external ? '_blank' : undefined}
                          rel={l.external ? 'noopener noreferrer' : undefined}
                          aria-label={l.label}
                        >
                          <Button className="w-full justify-start" variant={l.variant ?? 'ghost'}>
                            {l.label}
                          </Button>
                        </Link>
                      ) : (
                        <Link
                          href={l.href}
                          className={cn(
                            'rounded-md px-3 py-2 text-sm transition-colors',
                            active ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                          )}
                          target={l.external ? '_blank' : undefined}
                          rel={l.external ? 'noopener noreferrer' : undefined}
                          aria-current={active ? 'page' : undefined}
                        >
                          {l.label}
                        </Link>
                      )}
                    </SheetClose>
                  );
                })}

                {/* ⚠️ Secondary destinations, kept reachable on phones. Contact left the top-level
                    nav and Partners left it entirely, and on desktop both are in the page footer —
                    but the mobile sheet REPLACES the nav, not the footer, so without this pair they
                    would simply be gone on a phone. Quiet, and present. */}
                <div className="mt-4 border-t border-zinc-800/60 pt-3">
                  {[
                    { label: 'Contact', href: '/contact' },
                    { label: 'Partners & resellers', href: '/partners' },
                  ].map((l) => (
                    <SheetClose asChild key={l.href}>
                      <Link
                        href={l.href}
                        className={cn(
                          'block rounded-md px-3 py-2 text-sm transition-colors',
                          pathname === l.href
                            ? 'bg-zinc-800 text-white'
                            : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                        )}
                        aria-current={pathname === l.href ? 'page' : undefined}
                      >
                        {l.label}
                      </Link>
                    </SheetClose>
                  ))}
                </div>

                {/* Cart button (always visible on mobile; it hides itself when empty & ecom off) */}
                <div className="mt-3">
                  <CartButton hideWhenEmpty={false} className="w-full justify-center" />
                </div>

                <SheetClose asChild>
                  <Button variant="ghost" className="mt-2 w-full gap-2" aria-label="Close menu">
                    <X className="h-4 w-4" /> Close
                  </Button>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
