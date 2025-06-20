import { useSession } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export function withAuth<P extends object>(WrappedComponent: React.ComponentType<P>) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  const ProtectedComponent = function (props: P) {
    const session = useSession();
    const router = useRouter();

    useEffect(() => {
      if (session === null) {
        router.push(`/login?redirectTo=${encodeURIComponent(router.asPath)}`);
      }
    }, [session]);

    if (session === null) return null;
    return <WrappedComponent {...props} />;
  };
}
