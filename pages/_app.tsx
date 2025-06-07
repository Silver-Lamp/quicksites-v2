'use client';

import { DefaultSeo } from 'next-seo';
import SEO from '../next-seo.config';
import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { ThemeProvider } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/router';
import ResponsiveAdminLayout from '@/components/admin/ResponsiveAdminLayout';
import '@/styles/globals.css';

const SupabaseProvider = dynamic(() => import('@/components/admin/SafeSupabaseProvider'), {
  ssr: false,
  loading: () => <div>Loading app...</div>,
});

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAdminRoute = router.pathname.startsWith('/admin');

  const page = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={router.route}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        <Component {...pageProps} />
      </motion.div>
    </AnimatePresence>
  );

  return (
    <>
      <DefaultSeo {...SEO} />
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <SupabaseProvider>
          {isAdminRoute ? <ResponsiveAdminLayout>{page}</ResponsiveAdminLayout> : page}
        </SupabaseProvider>
      </ThemeProvider>
    </>
  );
}
