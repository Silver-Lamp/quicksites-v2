import { NextSeo } from 'next-seo';
import { usePageSeo } from '@/lib/usePageSeo';
import * as Sentry from '@sentry/nextjs';
import { u
  const seo = usePageSeo({
    description: 'Unauthorized page.',
    noindex: true,
  });
seCurrentUser } from '@/hooks/useCurrentUser';
import { useEffect } from 'react';

export default function UnauthorizedPage() {
  const { session, email, role } = useCurrentUser();

  useEffect(() => {
    Sentry.captureEvent({
      level: 'info',
      message: 'User viewed /unauthorized',
      tags: {
        route: '/unauthorized'
      },
      extra: {
        email: email || 'unknown',
        role: role || 'unknown',
        timestamp: new Date().toISOString()
      }
    });
  }, []);
  const supportEmail = session?.user?.app_metadata?.org_support_email
  || process.env.NEXT_PUBLIC_SUPPORT_EMAIL
  || 'support@example.com';

  return (<>
      <NextSeo {...seo} />
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold">403 - Forbidden</h1>
        <p className="text-gray-400">You do not have access to this page.</p>
        <a href="/" className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Return to Dashboard
        </a>
        <p className="text-sm text-gray-500">Need help? <a href={`mailto:${supportEmail}`} className="underline text-blue-400">Contact Support</a></p>
      </div>
    </div>
  );
}
