// ✅ FILE: pages/404.tsx

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <h1 className="text-5xl font-bold mb-4">404</h1>
      <p className="text-lg text-gray-400 mb-6 text-center">
        This page could not be found. It may have been removed or moved.
      </p>
      <Link
        href="/"
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        ← Return to Home
      </Link>
    </div>
  );
}
