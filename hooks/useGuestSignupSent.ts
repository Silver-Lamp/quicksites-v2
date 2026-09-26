'use client';

// hooks/useGuestSignupSent.ts
//
// "Has this guest already asked us to send the confirmation?" — shared by every surface that
// otherwise keeps asking them to sign up.
//
// ⚠️ TWO SOURCES, AND THE SECOND IS THE AUTHORITATIVE ONE. `sessionStorage` covers the moment
// (instant, survives a reload in this tab). But a guest who submits, then opens the editor in a
// NEW TAB to keep working while waiting for the mail, has an empty sessionStorage there — and
// would be asked to sign up again, having already done it. Supabase's user record carries
// `new_email` while a change awaits confirmation, so that is checked too and wins.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { GUEST_SIGNUP_SENT_EVENT, guestSignupSent } from '@/lib/auth/guestSignup';

export function useGuestSignupSent(): boolean {
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let alive = true;
    // 1. This tab, instantly.
    if (guestSignupSent()) setSent(true);

    // 2. Any tab: a pending email change on the account itself.
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const pending = (data?.user as any)?.new_email;
        if (alive && pending) setSent(true);
      } catch {
        /* best-effort — the prompt simply stays, which is the safe direction */
      }
    })();

    const onSent = () => setSent(true);
    window.addEventListener(GUEST_SIGNUP_SENT_EVENT, onSent);
    return () => {
      alive = false;
      window.removeEventListener(GUEST_SIGNUP_SENT_EVENT, onSent);
    };
  }, []);

  return sent;
}
