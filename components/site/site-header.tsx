'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';

type LinkItem = {
  label: string;
  href: string;
  button?: boolean;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  external?: boolean;
};

type Props = {
  sticky?: boolean;                 // default: true
  logoSrc?: string;                 // default: '/favicon.ico'
  logoText?: string;                // default: 'QuickSites'
  logoHref?: string;                // default: '/'
  links?: LinkItem[];               // default list below
  className?: string;
};

const DEFAULT_LINKS: LinkItem[] = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Book', href: '/book' },
  { label: 'Contact', href: '/contact', button: true, variant: 'ghost' },
];

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
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
        <Link href={logoHref} className="flex items-center gap-2" aria-label="QuickSites home">
          <Image src={logoSrc} alt={logoText} width={24} height={24} className="rounded" />
          <span className="text-sm text-zinc-300">{logoText}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-4 text-sm">
          {links.map((l) =>
            l.button ? (
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
        </nav>

        {/* Mobile menu */}
        <div className="md:hidden">
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
