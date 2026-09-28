// components/admin/ppl-prefill.ts
//
// The one-line contract between the "Use this pick" button on a suggestion card and the attach
// form further down /admin/ppl. Shared so the event name cannot drift between the two files —
// a renamed string on one side would make the button silently do nothing, which is the failure
// mode a CustomEvent handoff is most prone to.

export const PPL_PREFILL_EVENT = 'qs:ppl-prefill';

export type PplPrefillDetail = {
  domain: string;
  /** E.164 or display format; the form normalises before sending. */
  forwardTo: string;
  /** Shown in the confirmation line so the operator sees WHO, not just a number. */
  businessName?: string | null;
};
