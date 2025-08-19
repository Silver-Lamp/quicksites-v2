import type { Metadata } from 'next';
import { headers } from 'next/headers';
import ClientChefsList from './ClientChefsList';

export const metadata: Metadata = {
  title: 'Chefs — delivered.menu',
  description: 'Browse approved chefs on delivered.menu.',
};

async function deriveSiteSlug(defaultSlug = 'deliveredmenu'): Promise<string> {
  const h = await headers();
  const explicit = h.get('x-site-slug');
  if (explicit) return explicit;

  const host = (h.get('x-forwarded-host') || h.get('host') || '').toLowerCase();
  if (!host) return defaultSlug;
  if (host.startsWith('delivered.menu')) return 'deliveredmenu';

  const sub = host.split(':')[0].split('.')[0];
  if (sub && sub !== 'www' && sub !== 'localhost') {
    return sub.replace(/[^a-z0-9-]/g, '').replace(/-/g, '');
  }
  return defaultSlug;
}

export default async function ChefsIndexPage() {
  const siteSlug = await deriveSiteSlug();

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Chefs</h1>
        <p className="text-sm text-muted-foreground">Meet our approved chefs on delivered.menu.</p>
      </header>

      <ClientChefsList slug={siteSlug} />
    </div>
  );
}
