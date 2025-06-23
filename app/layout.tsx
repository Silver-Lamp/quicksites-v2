// app/layout.tsx
import WithAuth from '@/lib/auth/AuthProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  console.log('[💡 RootLayout Loaded]');
  return (
    <html lang="en">
      <body>
        <WithAuth>{children}</WithAuth>
      </body>
    </html>
  );
}
