// app/layout.tsx
import WithAuth from '@/lib/auth/AuthProvider';
import AppHeader from '@/components/admin/AppHeader/app-header';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  console.log('[💡 RootLayout Loaded]');
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <AppHeader />
        <WithAuth>
          <main>{children}</main>
        </WithAuth>
      </body>
    </html>
  );
}
