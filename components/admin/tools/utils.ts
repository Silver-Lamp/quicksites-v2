// components/admin/tools/utils.ts
'use client';

export type Json = Record<string, any>;

export async function postJSON(url: string, body: Json) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const passwordIssues = (v: string) => {
  const issues: string[] = [];
  if (v.length < 8) issues.push('at least 8 characters');
  if (!/[A-Z]/.test(v)) issues.push('an uppercase letter');
  if (!/[a-z]/.test(v)) issues.push('a lowercase letter');
  if (!/[0-9]/.test(v)) issues.push('a number');
  return issues;
};

export const parseUsdToCents = (usd: string): number | null => {
  const n = Number(String(usd).replace(/[^0-9.]/g, ''));
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
};

export const isState2 = (v: string) => /^[A-Za-z]{2}$/.test(v);
