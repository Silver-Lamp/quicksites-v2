'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@supabase/auth-helpers-react';

export default function AddHabitBlock() {
  const router = useRouter();
  const user = useUser();
  const params = useSearchParams();
  const slug = params?.get('slug') || '';
  const [status, setStatus] = useState('initial');

  useEffect(() => {
    if (!slug || !user) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      setStatus('saving');
      const res = await fetch('/api/create-block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.access_token}`
        },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          title: slug.charAt(0).toUpperCase() + slug.slice(1),
          message: `Tracking: ${slug}`,
          emoji: slug === 'floss' ? '🦷' : slug === 'water' ? '💧' : '🧘',
          slug,
          type: 'tracking',
          actions: [{ label: 'Check In', type: 'check-in', target: slug }]
        })
      });

      if (res.ok) {
        setStatus('done');
        router.push('/world/me');
      } else {
        setStatus('error');
      }
    });
  }, [slug, user]);

  return (
    <div className="text-white p-6 text-center">
      {status === 'saving' && <p>📍 Pinning to your current location...</p>}
      {status === 'done' && <p>✅ Added! Redirecting...</p>}
      {status === 'error' && <p className="text-red-500">⚠️ Error adding block.</p>}
    </div>
  );
}
