export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
// Import the canonical implementation
import { POST as createSnapshot } from '../snapshots/route';

// Delegate to the plural route so behavior is identical
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return createSnapshot(req, ctx);
}
