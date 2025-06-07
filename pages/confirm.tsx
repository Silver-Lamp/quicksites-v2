'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ConfirmPage() {
  const router = useRouter();
  const { code } = router.query;

  useEffect(() => {
    if (!code) return;
    // for now: assume any code is valid
    localStorage.setItem('invite_verified', 'true');
    setTimeout(() => router.push('/starter'), 1000);
  }, [code]);

  return (
    <div className="p-6 text-white text-center">
      <h1 className="text-2xl font-bold mb-4">🔓 Confirming Access…</h1>
      <p className="text-zinc-400">You’ll be redirected shortly.</p>
    </div>
  );
}
