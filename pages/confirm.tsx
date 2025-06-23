'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ConfirmPage() {
  const searchParams = useSearchParams();
  const code = searchParams?.get('code') as string;

  useEffect(() => {
    if (!code) return;
    // for now: assume any code is valid
    localStorage.setItem('invite_verified', 'true');
    setTimeout(() => (window.location.href = '/starter'), 1000);
  }, [code]);

  return (
    <div className="p-6 text-white text-center">
      <h1 className="text-2xl font-bold mb-4">🔓 Confirming Access…</h1>
      <p className="text-zinc-400">You’ll be redirected shortly.</p>
    </div>
  );
}
