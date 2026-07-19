// components/site/site-footer.tsx
//
// Shared public/marketing footer. The load-bearing bit is the "made by Point Seven Studio" link →
// the cross-product studio hub on HiveJournal (parity with hivejournal.com's own footer), tying
// QuickSites into the Point Seven Studio family (HiveJournal, delivered.menu, DeckSketch, …).
// Drop <SiteFooter /> at the bottom of any SiteHeader-fronted marketing page.

import Link from 'next/link';

export const POINT_SEVEN_STUDIO_URL = 'https://www.hivejournal.com/point-seven-studio';

const NAV: Array<{ label: string; href: string }> = [
  { label: 'Features', href: '/features' },
  { label: 'Restaurants', href: '/restaurants' },
  { label: 'Realtors', href: '/realtors' },
  { label: 'Partners', href: '/partners' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Compare', href: '/compare' },
  { label: 'Contact', href: '/contact' },
];

const LEGAL: Array<{ label: string; href: string }> = [
  { label: 'Privacy', href: '/legal/privacy' },
  { label: 'Terms', href: '/legal/terms' },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-zinc-800/70 bg-zinc-950">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-zinc-400">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 flex flex-col items-center gap-3 border-t border-zinc-800/60 pt-6 text-xs text-zinc-500 sm:flex-row sm:justify-between">
          <p>
            © {year} QuickSites · made by{' '}
            <a
              href={POINT_SEVEN_STUDIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
            >
              Point Seven Studio
            </a>
            .
          </p>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-zinc-300 transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
