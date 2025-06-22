'use client';

import Link from 'next/link';

export default function GoodbyePage() {
  return (
    <div className="max-w-lg mx-auto p-6 text-white text-center">
      <h1 className="text-3xl font-bold mb-4">👋 Goodbye, and thank you.</h1>
      <p className="mb-4">Your account has been deleted from QuickSites.</p>
      <p className="text-zinc-400 text-sm mb-6">
        If you helped steward any sites, your legacy will live on in the public ledger.
      </p>
      <Link href="/transparency" className="text-blue-400 underline text-sm">
        View public log →
      </Link>
    </div>
  );
}
