// app/api/public/showcase/route.ts
//
// Public, read-only feed for the homepage showcase (client revalidation). The
// same data is server-rendered on the homepage via getShowcaseData() for SSR.

import { NextResponse } from 'next/server';
import { getShowcaseData } from '@/lib/home/getShowcaseData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await getShowcaseData();
  return NextResponse.json(data);
}
