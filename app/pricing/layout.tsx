// app/pricing/layout.tsx
// The pricing page is a client component and can't export metadata, so this
// server-component layout carries the branded OG/Twitter card for /pricing.
import type { ReactNode } from 'react';
import { marketingOg } from '@/lib/marketingOg';

export const metadata = marketingOg({
  title: 'QuickSites Pricing — near-free hosting, monetized by commerce',
  description:
    'Near-free hosting for local business sites. QuickSites earns a small platform fee on commerce, not a flat per-site SaaS seat.',
  path: '/pricing',
  ogEyebrow: 'Pricing',
  ogTitle: 'Near-free hosting. We earn when you sell.',
  ogSubtitle: 'No flat per-site SaaS seat — QuickSites takes a small platform fee on commerce, so pricing scales with your success.',
});

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children;
}
