import { useRouter } from 'next/navigation.js';
import { useCurrentUser } from './useCurrentUser.js';
import { useQueryParam } from './useQueryParam.js';
import { useEffect, useState } from 'react';

export async function useRedirectAfterLogin() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const redirectTo = useQueryParam('redirectTo', '/admin/dashboard');
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const loadToast = async () => {
      if (user && redirectTo) {
        const { toast } = await import('react-hot-toast');
        if (typeof toast.success === 'function') {
          toast.success('✅ Logged in! Redirecting...', {
            duration: 3000,
            style: {
              background: '#1e1e1e',
              color: '#fff',
            },
          });
        }

        setIsRedirecting(true);

        setTimeout(() => {
          router.replace(redirectTo);
        }, 1000);
      }
    };

    loadToast();
  }, [user, redirectTo, router]);

  return { redirectTo, isRedirecting };
}
