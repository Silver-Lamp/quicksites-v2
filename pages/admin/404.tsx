// ✅ FILE: pages/admin/404.tsx

import Link from 'next/link';
import { useLogNotFound } from '@/hooks/useLogNotFound';

export default function AdminNotFound() {
  useLogNotFound('admin');

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold mb-4">404</h1>
      <p className="text-lg text-gray-400 mb-6">
        This admin page could not be found.
      </p>
      <Link
        href="/admin/dashboard"
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}
