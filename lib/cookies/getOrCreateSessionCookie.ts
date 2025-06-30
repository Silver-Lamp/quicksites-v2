'use server';

import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

/**
 * Returns the current session-id cookie if present, or generates a new one.
 * Does not write the cookie—safe for layout.tsx or any SSR context.
 */
export async function getOrCreateSessionCookie(): Promise<string> {
  const store = await cookies(); // ✅ await here
  const existing = store.get('session-id')?.value;

  if (existing) return existing;

  // ⚠️ Do NOT set cookies from here — handled by middleware or Server Action
  return uuidv4();
}
