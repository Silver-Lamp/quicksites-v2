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

  // Fail-soft env check: log a clear signal at boot if a required server var is
  // missing, instead of failing deep inside a request. Non-throwing on purpose so
  // it can't break a build/preview that intentionally runs with partial env.
  const { validateServerEnv } = await import('@/lib/env');
  const { ok, problems } = validateServerEnv();
  if (!ok) {
    console.warn('[env] server environment incomplete:\n' + problems.map((p) => '  - ' + p).join('\n'));
  }

  // Rule 7 of the adopted config standard (crosstalk/contracts/config-registry.md): report
  // any feature that is ENABLED but incompletely configured. validateServerEnv above only
  // covers the three boot-critical Supabase vars — it cannot catch a flag flipped on with a
  // required key missing, which is the failure that actually keeps happening here (partner
  // audio inert five days on 1 of 3 vars; a captcha silently off on a name mismatch).
  //
  // Non-throwing on purpose: a boot loop is a worse outage than the thing being reported.
  try {
    const { configHealth, bootReportLines } = await import('@/lib/config/health');
    const health = configHealth();
    const lines = bootReportLines(health).join('\n');
    if (health.ok) console.log(lines);
    else console.warn(lines);
  } catch (e: any) {
    // The check failing must never be worse than not having it.
    console.warn('[config] health check could not run:', e?.message ?? e);
  }
}
