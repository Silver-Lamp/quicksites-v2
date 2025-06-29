'use client';

import { useSafeAuth } from '../hooks/useSafeAuth';
import event from '@vercel/analytics';

export function useTrack() {
  const { user, role, isLoggedIn } = useSafeAuth();

  const track = (name: string, data: Record<string, any> = {}) => {
    try {
      event.track(name, {
        user: user?.id || user?.email || 'guest',
        role,
        isLoggedIn,
        ...data,
      });
    } catch (err) {
      console.warn('[⚠️ useTrack event failed]', err);
    }
  };

  return track;
}
