import SmartLinkGallery from '@/components/admin/SmartLinkGallery';
import { SmartLinkProvider } from '@/components/admin/SmartLinkProvider';
import type { SmartLinkItem } from '@/admin/types/SmartLinkItem';

export default function SmartLinkHomePage() {


  const items: SmartLinkItem[] = [
    { id: 'abc123', type: 'template', label: 'Home Template', theme: 'primary' },
    { id: 'xyz789', type: 'snapshot', label: 'Shared Snapshot', query: { shared: true }, theme: 'muted' },
    { id: '', type: 'template', label: 'Missing Template', theme: 'danger' }
  ];

  return (
    <SmartLinkProvider>
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-white">SmartLink System</h1>
        <SmartLinkGallery items={items} />
      </main>
    </SmartLinkProvider>
  );
}
