'use client';

// hooks/useIsGuest.ts
//
// Is the current browser session an anonymous (guest-build) user?
//
// Reads the Supabase session directly rather than going through CurrentUserContext, because a
// guest is deliberately outside the full admin provider tree — `app/admin/layout.tsx` routes
// them to GuestChrome, a minimal shell. A hook that depended on the admin context would return
// false for exactly the users it exists to identify.
//
// Defaults to FALSE and only flips true once Supabase has answered. That direction matters: a
// wrong `true` would show a signed-in owner guest-only copy about signing up, which is
// confusing and slightly insulting; a wrong `false` briefly withholds reassurance from a guest.
// The second failure is the cheaper one.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { isGuestUser } from '@/lib/auth/guestSession';

export function useIsGuest(): boolean {
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (alive) setGuest(isGuestUser(data?.user));
      })
      .catch(() => {
        /* never block the editor on this — the reassurance is nice-to-have, the editor isn't */
      });
    return () => {
      alive = false;
    };
  }, []);

  return guest;
}
