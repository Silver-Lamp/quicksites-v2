// /app/page-v0.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

import Link from 'next/link';
import { getRoleRedirectTarget } from '@/lib/supabase/getRoleRedirectTarget';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const { path, role, user, slug } = await getRoleRedirectTarget();

  if (!user) {
    console.log('[🔓 HomePage] Guest access — rendering public fallback');
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Welcome to QuickSites</h1>
          <p className="text-gray-400">Your one-click local website is moments away.</p>
          <Link
            href="/login"
            className="mt-4 inline-block bg-white text-black px-4 py-2 rounded hover:bg-gray-200"
          >
            Log In to Get Started
          </Link>
        </div>
      </div>
    );
  }

  console.log('[🔁 HomePage Redirect]', {
    user: user.email,
    role,
    slug,
    target: path,
  });

  redirect(path);
}
