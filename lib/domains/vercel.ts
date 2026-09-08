// lib/domains/vercel.ts
import { NextResponse } from 'next/server';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN!;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || undefined;

function vercelURL(path: string) {
  const base = `https://api.vercel.com${path}`;
  return VERCEL_TEAM_ID ? `${base}${path.includes('?') ? '&' : '?'}teamId=${VERCEL_TEAM_ID}` : base;
}

async function vercelFetch(path: string, init?: RequestInit) {
  const res = await fetch(vercelURL(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || `Vercel ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function addProjectDomain(name: string) {
  return vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function removeProjectDomain(name: string) {
  return vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

export async function getProjectDomainConfig(name: string) {
  // Returns config + verification records Vercel expects
  return vercelFetch(
    `/v10/projects/${VERCEL_PROJECT_ID}/domains/config?name=${encodeURIComponent(name)}`
  );
}

/**
 * Add a DNS record to a domain whose nameservers point at Vercel (i.e. a domain we
 * registered/manage here). Used to publish the google-site-verification TXT for programmatic
 * GSC connect. `name` is the subdomain ('' / '@' = apex). Returns the created record.
 */
export async function addDnsRecord(
  domain: string,
  record: { type: string; name?: string; value: string; ttl?: number },
) {
  return vercelFetch(`/v2/domains/${encodeURIComponent(domain)}/records`, {
    method: 'POST',
    body: JSON.stringify({
      type: record.type,
      name: record.name ?? '',
      value: record.value,
      ttl: record.ttl ?? 60,
    }),
  });
}

/** Convenience: publish an apex TXT record (e.g. a domain-verification token). */
export async function addDnsTxtRecord(domain: string, value: string, name = '') {
  return addDnsRecord(domain, { type: 'TXT', name, value });
}

/**
 * Is a Google site-verification TXT already published on this zone? Lets the GSC backfill tell
 * "TXT written, Google has not seen it yet" (retry the verify) from "never started" (ask for a
 * token and write one) — without writing a duplicate record each night. Null when the zone is
 * not on Vercel or the lookup fails.
 */
export async function hasGoogleVerificationTxt(domain: string): Promise<boolean | null> {
  try {
    const json = await vercelFetch(`/v4/domains/${encodeURIComponent(domain)}/records?limit=100`);
    const records: Array<{ type?: string; value?: string; name?: string }> = json?.records ?? [];
    return records.some(
      (r) => String(r.type).toUpperCase() === 'TXT' && String(r.value ?? '').startsWith('google-site-verification=') && (!r.name || r.name === '' || r.name === '@'),
    );
  } catch {
    return null;
  }
}
