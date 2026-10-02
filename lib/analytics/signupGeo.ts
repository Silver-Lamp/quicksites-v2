// lib/analytics/signupGeo.ts
//
// Where a person first reached us, coarsely.
//
// ⚠️ THE IP NEVER LEAVES THIS FUNCTION, AND IS NEVER READ IN THE FIRST PLACE. Vercel's edge
// resolves the address to country/region/city and hands us those as headers; we take them and
// nothing else. Storing the IP would answer questions nobody asked while creating a PII store
// that then needs retention, governance and deletion paths.
//
// ⚠️ FIRST TOUCH WINS. The row is inserted once and never updated, so this means "signed up
// from", not "currently in" — a later visit from an airport must not rewrite where someone
// came from.
//
// ⚠️ IT IS BEST-EFFORT AND MUST STAY THAT WAY. It is called on the path that creates a site;
// a geo write failing is not a reason for a person's site to fail.

import { supabaseAdmin } from '@/lib/supabase/admin';

export type SignupGeo = { country: string | null; region: string | null; city: string | null };

/**
 * Read Vercel's geo headers off a request.
 *
 * ⚠️ `x-vercel-ip-city` is URL-ENCODED — `San%20Francisco`, `Z%C3%BCrich`. Stored raw it
 * produces a city list full of percent signs that looks like corruption and sorts wrongly.
 * Absent locally and on any non-Vercel host, which yields nulls rather than a fake "Unknown".
 */
export function geoFromHeaders(h: Headers): SignupGeo {
  const get = (k: string) => {
    const v = h.get(k);
    if (!v) return null;
    try {
      const decoded = decodeURIComponent(v).trim();
      return decoded.length > 0 && decoded.length <= 120 ? decoded : null;
    } catch {
      // A malformed escape is not worth failing over; keep the raw value if it is sane.
      const raw = v.trim();
      return raw.length > 0 && raw.length <= 120 ? raw : null;
    }
  };
  return {
    country: get('x-vercel-ip-country'),
    region: get('x-vercel-ip-country-region'),
    city: get('x-vercel-ip-city'),
  };
}

/** True when there is anything worth recording. */
export function hasGeo(g: SignupGeo): boolean {
  return !!(g.country || g.region || g.city);
}

/**
 * Record where this user first arrived, once.
 *
 * Never throws: the caller is on a site-creation path and a missing analytics row is a far
 * smaller problem than a failed build.
 */
export async function recordSignupGeo(
  userId: string,
  headers: Headers,
  source = 'template_create',
): Promise<void> {
  try {
    if (!userId) return;
    const geo = geoFromHeaders(headers);
    // Nothing useful (local dev, a non-Vercel host) → write nothing. An all-null row would
    // claim we looked and found nobody home, which is different from not having looked.
    if (!hasGeo(geo)) return;

    // ⚠️ `ignoreDuplicates` is what makes this first-touch. An upsert that overwrote would turn
    // "signed up from" into "last seen in" without anything in the schema saying so.
    await supabaseAdmin
      .from('user_signup_geo')
      .upsert({ user_id: userId, ...geo, source }, { onConflict: 'user_id', ignoreDuplicates: true });
  } catch {
    /* best-effort by design — see the header */
  }
}
