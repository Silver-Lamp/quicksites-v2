import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useCurrentUser } from '@/admin/hooks/useCurrentUser';

import { useQueryParam } from '@/admin/hooks/useQueryParam';

export function useRedirectAfterLogin() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const redirectTo = useQueryParam('redirectTo', '/admin/dashboard');

  useEffect(() => {

    if (user && redirectTo) {
      const toast = require('react-hot-toast');
      toast.success('Logged in! Redirecting...');
      setTimeout(() => {
        router.replace(redirectTo);
      }, 1000);
    }
  }, [user, redirectTo, router]);

  return redirectTo;
}
