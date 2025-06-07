'use client';

import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { ThemeProvider } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import ResponsiveAdminLayout from '@/components/admin/ResponsiveAdminLayout';
import '@/admin/styles/globals.css';

const SupabaseProvider = dynamic(() => import('@/admin/components/SupabaseProvider'), {
  ssr: false,
  loading: () => <div>Loading admin...</div>,
});

export default function AdminApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SupabaseProvider>
        <ResponsiveAdminLayout>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={Component.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Component {...pageProps} />
            </motion.div>
          </AnimatePresence>
        </ResponsiveAdminLayout>
      </SupabaseProvider>
    </ThemeProvider>
  );
}
