'use client';

import { useSafeAuth } from '../hooks/useSafeAuth';

export function useErrorLogger() {
  const { user, role } = useSafeAuth();

  return (message: string, context: Record<string, any> = {}) => {
    console.warn('[🚨 logError]', {
      message,
      userId: user?.id ?? 'guest',
      role,
      ...context,
    });

    // send to future backend here
  };
}
