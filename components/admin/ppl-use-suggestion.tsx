'use client';

// components/admin/ppl-use-suggestion.tsx
//
// "Use this pick" — carries a recommended forward-to from the suggestion card down to the attach
// form, instead of the operator re-typing a phone number.
//
// ⚠️ THE POINT IS THE TRANSCRIPTION, NOT THE CLICKS SAVED. The two fields being copied are a
// domain and a ten-digit phone number, and a dropped digit does not fail — it attaches cleanly
// and routes a stranger's 2am towing call to whoever owns the number you actually typed. That is
// the one error in this flow with a person on the other end of it, and it is invisible from the
// admin page afterwards.
//
// ⚠️ It PREFILLS, it does not attach. Attaching buys nothing but it does repoint a live number
// and text a real business the one-time notice, so the last click stays deliberate and stays
// with the operator — who still has to choose WHICH Twilio number, a decision the suggestion
// cannot make (see the page: only two campaigns have a matching number already on the account).
//
// Implemented as a window CustomEvent rather than lifted state because the card and the form sit
// in different parts of a SERVER component; threading a client store between them would mean
// restructuring the page to solve a two-field handoff.
import { PPL_PREFILL_EVENT, type PplPrefillDetail } from './ppl-prefill';

export default function PplUseSuggestion({ domain, forwardTo, businessName }: PplPrefillDetail) {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent<PplPrefillDetail>(PPL_PREFILL_EVENT, {
            detail: { domain, forwardTo, businessName },
          }),
        );
      }}
      className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-200 hover:bg-sky-500/20"
    >
      Use this pick →
    </button>
  );
}
