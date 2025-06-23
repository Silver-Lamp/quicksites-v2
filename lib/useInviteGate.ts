import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useInviteGate(allow = false) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const verified = localStorage.getItem('invite_verified') === 'true';

    if (!allow && !verified) {
      router.push('/early-access');
    }
  }, []);
}
