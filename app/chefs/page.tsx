import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const ChefsList = dynamic(() => import('@/components/public/chefs-list'), { ssr: false });

export const metadata: Metadata = {
  title: 'Chefs — delivered.menu',
  description: 'Browse approved chefs on delivered.menu',
};

export default function ChefsIndexPage() {
  // Prefer resolving this from your tenant/host; hardcode for now:
  const siteSlug = 'deliveredmenu';

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Chefs</h1>
        <p className="text-sm text-muted-foreground">Meet our approved chefs on delivered.menu.</p>
      </header>

      <ChefsList slug={siteSlug} showSearch />
    </div>
  );
}
