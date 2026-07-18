// app/api/admin/design-partners/route.ts
//
// Superadmin: list the design-partner outreach registry (contacts + /for-<name> pages + pipeline
// status). Admin-gated; data via lib/admin/designPartners (code defaults + site_settings overrides).

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { listDesignPartners } from '@/lib/admin/designPartners';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const partners = await listDesignPartners();
  return NextResponse.json({ partners });
}
