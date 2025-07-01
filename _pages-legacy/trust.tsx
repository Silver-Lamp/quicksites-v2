'use client';
import Link from 'next/link';

export default function TrustPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-3xl font-bold mb-4">🛡 Our Commitment to Trust</h1>
      <p className="mb-4">
        QuickSites is designed to be transparent, secure, and user-owned. Here’s how we honor that:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-zinc-300">
        <li>
          📦 All published site previews are visible via{' '}
          <Link href="/transparency" className="underline">
            /transparency
          </Link>
        </li>
        <li>🔐 Screenshots and claims are logged, hashed, and RLS-protected</li>
        <li>
          🧾 Anyone can export audit logs from{' '}
          <Link href="/admin/audit" className="underline">
            /admin/audit
          </Link>
        </li>
        <li>
          📜 Read our{' '}
          <Link href="/security" className="underline">
            security practices
          </Link>
        </li>
      </ul>
      <p className="text-sm text-zinc-500">
        Data integrity matters. We believe transparency earns trust.
      </p>
    </div>
  );
}
