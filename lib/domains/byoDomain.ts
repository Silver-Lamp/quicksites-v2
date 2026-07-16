// lib/domains/byoDomain.ts
//
// "Bring your own domain" — the self-serve on-ramp for someone already PAYING for a
// domain elsewhere (Google/Squarespace/GoDaddy, often semi-parked with a registrar
// "under construction" page + Workspace email on MX). The core promises the flow makes:
//   1. NO transfer — they keep their registrar and keep paying it.
//   2. EMAIL IS SAFE — we only change where the WEBSITE points (A + www CNAME);
//      MX records are never touched, so Workspace/Gmail keeps working.
//   3. Two DNS records is the whole job.
// This module inspects where the domain points today (best-effort DNS resolution) and
// hands back the exact records to change. Used by /api/public/byo-domain/check for the
// /bring-your-domain flow.

import { resolveA, resolveCNAME } from '@/lib/domains/dns';
import { normalizeApex, withWWW, VERCEL_A_IPS, VERCEL_CNAME_TARGETS } from '@/lib/domains/util';

export type ByoDnsRecord = {
  /** 'A' | 'CNAME' */
  type: string;
  /** Host field as the registrar UI names it ('@' for the apex). */
  host: string;
  value: string;
  ttl: string;
};

export type ByoDomainStatus =
  /** Apex or www already resolves to us — DNS is done (or mid-propagation). */
  | 'points_here'
  /** Resolves somewhere else (the parked/under-construction page) — the normal case. */
  | 'parked_elsewhere'
  /** No A/CNAME at all — nothing will break by adding ours. */
  | 'no_website_records';

export type ByoDomainCheck = {
  domain: string;
  status: ByoDomainStatus;
  /** What the apex A record resolves to today (empty when none). */
  currentA: string[];
  /** What www CNAMEs to today (empty when none). */
  currentWwwCname: string[];
  /** The two records to set at the registrar. */
  records: ByoDnsRecord[];
};

/** The exact records a registrar needs — the entire "port your website" job. */
export function byoDnsRecords(): ByoDnsRecord[] {
  return [
    { type: 'A', host: '@', value: VERCEL_A_IPS[0], ttl: 'default (or 1 hour)' },
    { type: 'CNAME', host: 'www', value: VERCEL_CNAME_TARGETS[0], ttl: 'default (or 1 hour)' },
  ];
}

/**
 * Normalize + inspect a bring-your-own domain. Throws on an invalid domain string;
 * DNS failures degrade to 'no_website_records' (resolvers already swallow errors).
 */
export async function checkByoDomain(input: string): Promise<ByoDomainCheck> {
  const domain = normalizeApex(input);

  const [apexA, wwwCname] = await Promise.all([resolveA(domain), resolveCNAME(withWWW(domain))]);

  const pointsHere =
    apexA.some((ip) => VERCEL_A_IPS.includes(ip)) ||
    wwwCname.some((c) => VERCEL_CNAME_TARGETS.includes(c.toLowerCase().replace(/\.$/, '')));

  const status: ByoDomainStatus = pointsHere
    ? 'points_here'
    : apexA.length || wwwCname.length
      ? 'parked_elsewhere'
      : 'no_website_records';

  return { domain, status, currentA: apexA, currentWwwCname: wwwCname, records: byoDnsRecords() };
}
