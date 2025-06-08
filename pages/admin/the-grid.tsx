// ✅ FILE: pages/admin/the-grid.tsx

'use client';

import dynamic from 'next/dynamic';
import AuthGuard from '@/components/admin/AuthGuard';

const DynamicMap = dynamic(() => import('@/components/GridMap'), { ssr: false });

export default function TheGridPage() {
  return (
    <AuthGuard roles={['admin', 'owner', 'reseller']}>
      <div className="p-6 text-white">
        <DynamicMap />
      </div>
    </AuthGuard>
  );
}
