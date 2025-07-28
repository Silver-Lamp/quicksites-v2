// components/admin/templates/edit-client-wrapper.tsx
'use client';

import dynamic from 'next/dynamic';

const EditWrapper = dynamic(() => import('./edit-wrapper'), {
  ssr: false,
});

export default function ClientEntryPoint({ slug }: { slug: string }) {
  return <EditWrapper slug={slug} />;
}
