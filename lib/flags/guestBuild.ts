// lib/flags/guestBuild.ts
//
// Feature flag for the "guest build → sign up to publish" flow.
//
// OFF by default. Until this is flipped on, the new homepage hero falls back to
// its previous behavior and no anonymous Supabase sessions are minted.
//
// PREREQUISITES before enabling in any environment:
//   1. Enable "Allow anonymous sign-ins" in the Supabase project settings.
//   2. Tighten admin access so anonymous users can ONLY reach the template editor,
//      not the broader /admin surface (there are ~200 browser-client direct writes
//      on admin pages whose only gate today is getUser(); anonymous users pass it).
//      See the publish-gate / editor-chrome work (later phase).
//
// Same env var is read on client and server (NEXT_PUBLIC_ is inlined at build time).
export const GUEST_BUILD_ENABLED =
  process.env.NEXT_PUBLIC_GUEST_BUILD_ENABLED === '1' ||
  process.env.NEXT_PUBLIC_GUEST_BUILD_ENABLED === 'true';

export function guestBuildEnabled(): boolean {
  return GUEST_BUILD_ENABLED;
}
