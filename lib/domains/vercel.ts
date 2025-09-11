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
