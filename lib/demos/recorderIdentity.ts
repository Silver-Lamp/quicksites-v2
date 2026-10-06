// lib/demos/recorderIdentity.ts
//
// How the demo recorder's own guest builds can be told from a stranger's.
//
// `scripts/record-demo.mts` builds real sites through the real guest flow, each under a fresh
// anonymous user, so they land in `templates` and on /admin/users looking exactly like a member
// of the public ("Wildflower Candle Co." ×4, 2026-10-02). Anything that reacts to "a user built a
// site" — the owner email alert above all — must recognise them, and the only stable signature
// is the business name the recorder types. ⚠️ Kept here, imported by the recorder, pinned by a
// test: a name typed in the script and a name checked by the alert that drift apart produce an
// owner being emailed about his own demo at 6am.
export const DEMO_RECORDER_BUSINESS_NAMES = ['Wildflower Candle Co.'] as const;

export function isDemoRecorderBusinessName(name: string | null | undefined): boolean {
  const n = (name ?? '').trim().toLowerCase();
  return n.length > 0 && DEMO_RECORDER_BUSINESS_NAMES.some((x) => x.toLowerCase() === n);
}
