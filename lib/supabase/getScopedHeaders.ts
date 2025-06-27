'use server';

import type { Headers as ServerHeaders } from 'next/dist/compiled/@edge-runtime/primitives';

export async function getScopedHeaders(): Promise<ServerHeaders> {
  const { headers } = await import('next/headers'); // ✅ Lazy-loaded for safe runtime use
  return headers();
}
