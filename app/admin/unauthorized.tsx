// pages/unauthorized.tsx
'use client';

import * as Sentry from '@sentry/nextjs';
import Head from 'next/head';
import Link from 'next/link';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useEffect } from 'react';

export default function UnauthorizedPage() {
  const { session, email, role } = useCurrentUser() as any;

  useEffect(() => {
    Sentry.captureEvent({
      level: 'info',
      message: 'User viewed /unauthorized',
      tags: { route: '/unauthorized' },
      extra: {
        email: email || 'unknown',
        role: role || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  }, []);

  const supportEmail =
    session?.user?.app_metadata?.org_support_email ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    'support@example.com';

  return (
    <>
      <Head>
        <title>403 – Unauthorized</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold">403 - Forbidden</h1>
          <p className="text-gray-400">
            You do not have access to this page.
            {role && (
              <span className="block text-sm mt-1 text-gray-500">
                You are currently signed in as{' '}
                <span className="font-semibold text-white">{role}</span>.
              </span>
            )}
          </p>
          {role === 'viewer' && (
            <p className="text-sm text-yellow-400 mt-2">
              Looking for more access? Contact an admin or
              <Link href="/request-access" className="underline hover:text-yellow-300">
                {' '}
                request an upgrade
              </Link>
              .
            </p>
          )}
          <Link
            href="/"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Return to Dashboard
          </Link>
          <p className="text-sm text-gray-500">
            Need help?{' '}
            <a href={`mailto:${supportEmail}`} className="underline text-blue-400">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
