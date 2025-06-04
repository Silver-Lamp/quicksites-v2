// import type { AppProps } from 'next/app';
// import { useRouter } from 'next/router';
// import dynamic from 'next/dynamic';
// import AppHeader from '@/components/admin/AppHeader';
// import AdminLayout from '@/components/admin/AdminLayout';
// import { Toaster } from 'react-hot-toast';
// import '@/admin/styles/globals.css';

// // const Providers = dynamic(() => import('@/admin/components/Providers'), { ssr: false });

// // export default function App({ Component, pageProps }: AppProps) {
// //   const router = useRouter();
// //   const isAdminRoute = router.pathname.startsWith('/admin');

// //   const content = isAdminRoute ? (
// //     <AdminLayout>
// //       <Component {...pageProps} />
// //     </AdminLayout>
// //   ) : (
// //     <div className="dark bg-gray-900 min-h-screen text-gray-100">
// //       <AppHeader />
// //       <Component {...pageProps} />
// //     </div>
// //   );

// //   return (
// //     <Providers>
// //       <Toaster />
// //       {content}
// //     </Providers>
// //   );
// // }




// // const TestClientProvider = dynamic(() => import('@/admin/components/TestClientProvider'), {
// //   ssr: false,
// // });

// // export default function App({ Component, pageProps }: AppProps) {
// //   return (
// //     <TestClientProvider>
// //       <Component {...pageProps} />
// //     </TestClientProvider>
// //   );
// // }


// const SupabaseProvider = dynamic(() => import('@/admin/components/SupabaseProvider'), {
//   ssr: false,
// });


// export default function App({ Component, pageProps }: AppProps) {
//   const router = useRouter();
//   const isAdminRoute = router.pathname.startsWith('/admin');

//   const content = isAdminRoute ? (
//     <AdminLayout>
//       <Component {...pageProps} />
//     </AdminLayout>
//   ) : (
//     <div className="dark bg-gray-900 min-h-screen text-gray-100">
//       <AppHeader />
//       <Component {...pageProps} />
//     </div>
//   );

//   return (
//     <SupabaseProvider>
//       <Toaster />
//       {content}
//     </SupabaseProvider>
//   );
// }


// pages/_app.tsx
'use client';

import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import '@/admin/styles/globals.css';

const SupabaseProvider = dynamic(() => import('@/admin/components/SupabaseProvider'), {
  ssr: false,
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SupabaseProvider>
      <Component {...pageProps} />
    </SupabaseProvider>
  );
}
