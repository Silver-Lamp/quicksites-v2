// instrumentation.ts — runs once at server startup (Next.js).
//
// Supabase's new API keys (sb_secret_… / sb_publishable_…) are drop-in replacements
// for the legacy service_role / anon JWTs: supabase-js sends them to the API gateway
// unchanged, and nothing in this repo decodes them as JWTs. So migrating off the
// legacy keys is a value swap, not a code change.
//
// This shim lets you set the correctly-named NEW server key (SUPABASE_SECRET_KEY)
// without editing the 200+ files that read the legacy name: at boot we copy it onto
// SUPABASE_SERVICE_ROLE_KEY when that isn't already set. (Legacy var still wins if
// both are present, so existing deployments are untouched.)
//
// The publishable key is build-time inlined (NEXT_PUBLIC_*) and cannot be aliased at
// runtime — set its value directly in NEXT_PUBLIC_SUPABASE_ANON_KEY. The publishable
// key is public by design, so that variable name stays accurate.
export async function register() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (secret && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
  }
}
