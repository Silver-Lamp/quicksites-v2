import SmartLinkGallery from '@/components/admin/smart-link-gallery';
import { SmartLinkProvider } from '@/components/admin/smart-link-provider';
import type { SmartLinkItem } from '@/types/SmartLinkItem';

export default function SmartLinkGalleryPage() {
  const items: SmartLinkItem[] = [
    {
      id: 'tmpl-hero-001',
      type: 'template',
      label: 'Hero Template',
      theme: 'outline',
    },
    {
      id: 'snap-public-456',
      type: 'snapshot',
      label: 'Public Share',
      query: { shared: true },
      theme: 'primary',
    },
    { id: '', type: 'snapshot', label: 'Missing Snapshot', theme: 'danger' },
  ];

  return (
    <SmartLinkProvider>
      <main className="p-6">
        <h1 className="text-xl font-semibold text-white mb-4">📂 SmartLink Gallery</h1>
        <SmartLinkGallery items={items} />
      </main>
    </SmartLinkProvider>
  );
}
