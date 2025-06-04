'use client';

import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import '@/styles/globals.css';

const SupabaseProvider = dynamic(() => import('@/components/admin/SafeSupabaseProvider'), {
  ssr: false,
  loading: () => <div>Loading app...</div>,
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SupabaseProvider>
      <Component {...pageProps} />
    </SupabaseProvider>
  );
}
