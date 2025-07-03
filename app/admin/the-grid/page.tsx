// app/admin/the-grid/page.tsx
'use client';

import dynamic from 'next/dynamic';
// import AuthGuard from '@/components/admin/auth-guard';

const DynamicMap = dynamic(() => import('@/components/admin/grid-map'), {
  ssr: false,
});

export default function TheGridPage() {
  return (
    // <AuthGuard roles={['admin', 'owner', 'reseller']}>
      <div className="p-6 text-white">
        <DynamicMap />
      </div>
    // </AuthGuard>
  );
}
