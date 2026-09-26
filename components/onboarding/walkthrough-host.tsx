'use client';

// components/onboarding/walkthrough-host.tsx
//
// Decides whether the editor walkthrough runs, and records that it did.
//
// ⚠️ Mounted once in the editor shell, and it fetches BEFORE deciding. The preference lives in
// the database, not localStorage, because the whole requirement is "when they log back in" —
// which is precisely the case localStorage cannot serve: it is per-browser, and the existing
// coach mark it replaces reappears in every private window.
//
// ⚠️ It listens for a replay event so the account page can restart it without a reload.
import { useCallback, useEffect, useState } from 'react';
import EditorWalkthrough from '@/components/onboarding/editor-walkthrough';
import {
  WALKTHROUGH_PREF_KEY,
  WALKTHROUGH_QUERY_PARAM,
  WALKTHROUGH_REPLAY_EVENT,
  shouldRunWalkthrough,
  type UiPrefs,
} from '@/lib/onboarding/walkthrough';

// Re-exported for the components that already import it from here.
export { WALKTHROUGH_REPLAY_EVENT };

export default function WalkthroughHost({ enabled = true }: { enabled?: boolean }) {
  const [open, setOpen] = useState(false);

  // ⚠️ `?walkthrough=1` wins over the seen flag and runs immediately — that is the point of it.
  // The param is then STRIPPED from the address bar: left in place, every refresh restarts the
  // tour, and a URL is exactly the thing people bookmark, share in a support reply, and reload.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(WALKTHROUGH_QUERY_PARAM) !== '1') return;
    setOpen(true);
    url.searchParams.delete(WALKTHROUGH_QUERY_PARAM);
    window.history.replaceState({}, '', url.toString());
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/me/ui-prefs', { cache: 'no-store' });
        if (!res.ok) return; // signed out, or anonymous — no walkthrough, no error
        const json = (await res.json()) as { prefs?: UiPrefs };
        // ⚠️ `shouldRunWalkthrough(null)` is false. A failed read is not a new user, and showing
        // the tour again to a returning customer on every network hiccup is the nag this feature
        // is meant to replace.
        if (alive && shouldRunWalkthrough(json?.prefs ?? null)) setOpen(true);
      } catch {
        /* stay closed */
      }
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);

  useEffect(() => {
    const onReplay = () => setOpen(true);
    window.addEventListener(WALKTHROUGH_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(WALKTHROUGH_REPLAY_EVENT, onReplay);
  }, []);

  const handleDone = useCallback(() => {
    setOpen(false);
    // ⚠️ Recorded on ANY exit, not only on reaching the last step. Someone who skips or presses
    // Escape has told us they do not want it; re-running it next login would be worse than never
    // having shown it.
    void fetch('/api/me/ui-prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefs: { [WALKTHROUGH_PREF_KEY]: new Date().toISOString() } }),
    }).catch(() => {});
  }, []);

  if (!open) return null;
  return <EditorWalkthrough onDone={handleDone} />;
}
