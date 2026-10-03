// components/site/site-header.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GALLERY_HREF, INDUSTRY_NAV, moreIndustriesLabel } from '@/lib/site/industryNav';
import {
  DEFAULT_NEXT,
  LABEL_SIGN_IN,
  LABEL_SIGN_UP,
  signInHref,
  signUpHref,
} from '@/lib/auth/authLinks';
import { CurrentUserContext } from '@/components/admin/context/current-user-provider';
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
  /** The "+N more" style entry: accent-coloured, reads as a door to the rest. */
  accent?: boolean;
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
    // Grouped, not deleted. Each vertical with its own page still earns it — the change is that a
    // visitor opens the one that is theirs instead of reading all of them.
    //
    // ⚠️ THE SAME LIST AS THE HOMEPAGE PILLS, from lib/site/industryNav.ts (owner, 2026-10-03). This
    // dropdown used to hold six hand-typed verticals while the hero showed twelve pills and a
    // "+47 more" the dropdown lacked — two lists of "our industries" on one page. Job Seekers stays
    // in that list on purpose: Verbatim was once reachable from NOWHERE on this site, and its usage
    // was being read as weak demand when it measured discovery. The closing "+N more" entry opens
    // the gallery; N is derived from lib/industries, never typed.
    children: [
      ...INDUSTRY_NAV.map((e) => ({ label: e.label, href: e.href })),
      { label: moreIndustriesLabel(), href: GALLERY_HREF, accent: true },
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

/** Where "Sign out" goes: the existing page that signs out and lands on /login?logout=1. */
const SIGN_OUT_HREF = '/logout';
const LABEL_DASHBOARD = 'Dashboard';
const LABEL_SIGN_OUT = 'Sign out';

/**
 * The account corner of the header: "Sign in" + "Sign up" for a visitor, "Dashboard" + "Sign out"
 * for someone with an account (owner, 2026-10-03: "traditional signin/signup in the menus").
 *
 * ⚠️ Links come from lib/auth/authLinks — never a literal `/login`. Four spellings of the auth
 * route were once in use across the app and only one existed; the helper is the one thing that
 * knows the URL, and `authLinks.test.ts` greps every component for the dead ones.
 *
 * ⚠️ The server render shows the SIGNED-OUT pair and the client swaps after hydration. Session
 * state lives in a cookie the server could read, but this header sits on cached marketing pages;
 * rendering the common case (a visitor) keeps the two sign-in links in the served HTML for every
 * crawler and every visitor, and a returning owner sees "Dashboard" a frame later.
 *
 * ⚠️ An ANONYMOUS session (a guest builder) is treated as signed out. A guest has a draft that
 * belongs to their anon uid, and the in-editor sign-up box upgrades that uid in place; from a
 * marketing page we cannot know which draft is theirs, so the honest offer is the same two doors a
 * visitor gets, and the editor's banner does the upgrade. Showing "Dashboard" to a guest would
 * route them to a list the middleware does not let them see.
 */
function useAccountState(): 'visitor' | 'member' {
  const { user, ready } = React.useContext(CurrentUserContext);
  if (!ready || !user) return 'visitor';
  if ((user as { is_anonymous?: boolean | null }).is_anonymous) return 'visitor';
  return 'member';
}

function AuthLinksDesktop({ pathname }: { pathname: string | null }) {
  const state = useAccountState();
  if (state === 'member') {
    return (
      <>
        <Link
          href={DEFAULT_NEXT}
          className={cn(
            'text-zinc-300 hover:text-white transition-colors',
            pathname === DEFAULT_NEXT && 'text-white'
          )}
        >
          {LABEL_DASHBOARD}
        </Link>
        <Link href={SIGN_OUT_HREF} className="inline-flex" aria-label={LABEL_SIGN_OUT}>
          <Button size="sm" variant="ghost">{LABEL_SIGN_OUT}</Button>
        </Link>
      </>
    );
  }
  return (
    <>
      <Link
        href={signInHref()}
        className="text-zinc-300 hover:text-white transition-colors"
      >
        {LABEL_SIGN_IN}
      </Link>
      <Link href={signUpHref()} className="inline-flex" aria-label={LABEL_SIGN_UP}>
        <Button size="sm" variant="default">{LABEL_SIGN_UP}</Button>
      </Link>
    </>
  );
}

/** The same two doors inside the mobile sheet, full width, above the page links. */
function AuthLinksMobile() {
  const state = useAccountState();
  const pair =
    state === 'member'
      ? [
          { label: LABEL_DASHBOARD, href: DEFAULT_NEXT, variant: 'default' as const },
          { label: LABEL_SIGN_OUT, href: SIGN_OUT_HREF, variant: 'ghost' as const },
        ]
      : [
          { label: LABEL_SIGN_UP, href: signUpHref(), variant: 'default' as const },
          { label: LABEL_SIGN_IN, href: signInHref(), variant: 'ghost' as const },
        ];
  return (
    <div className="mb-3 flex flex-col gap-2 border-b border-zinc-800/60 pb-3">
      {pair.map((l) => (
        <SheetClose asChild key={l.href}>
          <Link href={l.href} className="inline-flex" aria-label={l.label}>
            <Button className="w-full justify-center" variant={l.variant}>
              {l.label}
            </Button>
          </Link>
        </SheetClose>
      ))}
    </div>
  );
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
                c.accent
                  ? 'mt-1 border-t border-zinc-800 pt-2 text-sky-300 hover:bg-sky-500/10 hover:text-sky-200'
                  : pathname === c.href
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

          {/* Divider + account: Sign in / Sign up, or Dashboard / Sign out. */}
          <span className="mx-1 h-5 w-px bg-zinc-800/50" />
          <AuthLinksDesktop pathname={pathname} />

          {/* Cart (shows only if ecom enabled or cart has items) */}
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
            {/* ⚠️ `overflow-y-auto` is load-bearing. The sheet is a fixed, full-height panel and
                Radix locks the page behind it, so if the panel itself does not scroll, whatever
                sits below the fold is simply unreachable — found on a real phone 2026-10-03 once
                Sign up / Sign in and the full industry list made the menu taller than a screen.
                `pb-safe`-style bottom padding keeps the last item above the iOS home bar. */}
            <SheetContent
              side="right"
              className="w-80 overflow-y-auto overscroll-contain bg-black/95 border-l border-zinc-800/40 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Image src={logoSrc} alt={logoText} width={20} height={20} className="rounded" />
                  <span>{logoText}</span>
                </SheetTitle>
              </SheetHeader>

              <nav className="mt-6 flex flex-col gap-2">
                <AuthLinksMobile />
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
                                c.accent
                                  ? 'text-sky-300 hover:bg-sky-500/10 hover:text-sky-200'
                                  : pathname === c.href
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
