// app/api/gsc/performance/route.ts
// 📊 Server-side GSC performance data
'use server';

import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getValidOAuthClient } from '@/lib/gsc/getValidOAuthClient';

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('site');
  if (!domain) return NextResponse.json({ error: 'Missing site param' }, { status: 400 });

  try {
    const oauth2Client = await getValidOAuthClient(domain);

    const searchconsole = google.searchconsole({
      version: 'v1',
      auth: oauth2Client,
    });

    const result = await searchconsole.searchanalytics.query({
      siteUrl: domain,
      requestBody: {
        startDate: '2024-07-01',
        endDate: '2024-07-28',
        dimensions: ['page'],
      },
    });

    return NextResponse.json(result.data.rows || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
