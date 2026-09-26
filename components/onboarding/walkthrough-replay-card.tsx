'use client';

// components/onboarding/walkthrough-replay-card.tsx
//
// "Show me the walkthrough again" — the account-page half of the feature.
//
// ⚠️ THIS IS WHY THE PREFERENCE IS IN THE DATABASE. A replay control is impossible over
// localStorage: this page cannot clear a flag held in whichever browser happened to dismiss it,
// and a person who dismissed the tour on their laptop would find this button doing nothing on
// their phone. The existing editor coach mark has exactly that shape today.
//
// ⚠️ It clears the flag and says where to go, rather than launching a tour here. The walkthrough
// points at editor controls; firing it on a settings page would spotlight elements that do not
// exist, which is the failure mode its own skip-missing-anchors logic exists to avoid.
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WALKTHROUGH_PREF_KEY, type UiPrefs } from '@/lib/onboarding/walkthrough';

type State = 'loading' | 'seen' | 'unseen' | 'reset' | 'error';

export default function WalkthroughReplayCard() {
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/me/ui-prefs', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { prefs?: UiPrefs };
        if (!alive) return;
        setState(json?.prefs?.[WALKTHROUGH_PREF_KEY] ? 'seen' : 'unseen');
      } catch {
        if (alive) setState('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function replay() {
    setState('loading');
    try {
      // ⚠️ null, not absent. The route's allowlist copies known keys through, so sending the key
      // with a null value is what actually clears it; omitting it would just leave the old value
      // in place and the button would appear to work while doing nothing.
      const res = await fetch('/api/me/ui-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs: { [WALKTHROUGH_PREF_KEY]: null } }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState('reset');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {state === 'reset'
          ? 'Done — it runs next time you open a site. You can also start it any time from the ? button in the editor toolbar.'
          : state === 'error'
            ? 'Could not read your preferences just now. Try again in a moment.'
            : state === 'unseen'
              ? 'You have not seen it yet — it runs the next time you open a site in the editor.'
              : 'A five-step tour of the editor: sections, blocks, pages, themes and publishing. The ? button in the editor toolbar starts it any time.'}
      </p>
      <Button
        variant="outline"
        onClick={replay}
        disabled={state === 'loading' || state === 'unseen' || state === 'reset'}
      >
        {state === 'reset' ? 'Will run next time' : 'Show the walkthrough again'}
      </Button>
    </div>
  );
}
