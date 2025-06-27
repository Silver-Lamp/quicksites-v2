'use client';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCanonicalRole } from '@/hooks/useCanonicalRole';
import AppHeader from '@/components/admin/AppHeader/app-header';

export default function DefaultPublicLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useCurrentUser();
  const { role } = useCanonicalRole();

  if (!ready || !user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading public layout...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <AppHeader user={user} role={role || ''} />
      <main className="p-6 max-w-5xl mx-auto">{children}</main>

      <footer className="text-center text-sm text-gray-500 mt-10 mb-6 space-y-2">
        © {new Date().getFullYear()} QuickSites. All rights reserved.
        <br />
        <a
          href="https://twitter.com/quicksites_ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          Follow us on Twitter
        </a>
        <br />
        <a href="/privacy" className="text-blue-400 hover:underline">
          Privacy Policy
        </a>{' '}
        ·
        <a href="/terms" className="text-blue-400 hover:underline">
          Terms of Use
        </a>{' '}
        ·
        <a
          href="https://github.com/Silver-Lamp/quicksites-core"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
