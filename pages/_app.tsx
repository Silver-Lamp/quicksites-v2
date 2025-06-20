// ✅ FILE: pages/_app.tsx

'use client';

import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { DefaultSeo } from 'next-seo';
import SEO from '@/next-seo.config';
import { ThemeProvider } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import ResponsiveAdminLayout from '@/components/admin/ResponsiveAdminLayout';
import DefaultPublicLayout from '@/components/layout/DefaultPublicLayout';
import { CurrentUserProvider } from '@/components/admin/context/CurrentUserProvider';
import { useSessionReady } from '@/hooks/useSessionReady';
import Loader from '@/components/ui/Loader';
import { useEffect } from 'react';

const SupabaseProvider = dynamic(() => import('@/components/admin/SafeSupabaseProvider'), {
  ssr: false,
  loading: () => <Loader message="Loading app..." />,
});

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAdminRoute = router.pathname.startsWith('/admin');
  const sessionReady = useSessionReady();

  useEffect(() => {
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth
        .getSession()
        .then(({ data }) => {
          const token = data?.session?.access_token;
          const metaRole = data?.session?.user?.user_metadata?.role;
          const builtInRole = data?.session?.user?.role;

          console.debug('🧠 [App Hydration]', {
            path: router.pathname,
            user: data?.session?.user?.email,
            role: {
              metadata: metaRole,
              builtin: builtInRole,
            },
            token: token ? `${token.slice(0, 4)}...${token.slice(-4)}` : 'none',
          });
          console.log('✅ [Role loaded]', {
            role: builtInRole,
            email: data?.session?.user?.email,
          });
        })
        .catch((err) => {
          console.error('❌ Failed to fetch session in _app.tsx:', err);
        });
    });
  }, [router.pathname]);

  if (!sessionReady) {
    console.log('[🔐 Waiting for session...]');
    return <Loader message="Authenticating..." />;
  }

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
          <CurrentUserProvider>
            {isAdminRoute ? (
              <ResponsiveAdminLayout>{page}</ResponsiveAdminLayout>
            ) : (
              <DefaultPublicLayout>{page}</DefaultPublicLayout>
            )}
          </CurrentUserProvider>
        </SupabaseProvider>
      </ThemeProvider>
    </>
  );
}
