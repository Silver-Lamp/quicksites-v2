// lib/domains/dns.ts
export const runtime = 'nodejs'; // ensure Node DNS is available

import { Resolver } from 'dns/promises';
const r = new Resolver();

export async function resolveA(name: string): Promise<string[]> {
  try { return await r.resolve4(name); } catch { return []; }
}
export async function resolveCNAME(name: string): Promise<string[]> {
  try { return await r.resolveCname(name); } catch { return []; }
}
export async function resolveNS(name: string): Promise<string[]> {
  try { return await r.resolveNs(name); } catch { return []; }
}
/** MX exchanges sorted by priority (lowest first); [] when none/error. */
export async function resolveMX(name: string): Promise<string[]> {
  try {
    const mx = await r.resolveMx(name);
    return mx.sort((a, b) => a.priority - b.priority).map((m) => m.exchange);
  } catch { return []; }
}
