// app/api/gsc/performance/all/route.ts
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getAllValidOAuthClients } from '@/lib/gsc/getAllValidOAuthClients';

export async function GET(req: NextRequest) {
  const startDate = req.nextUrl.searchParams.get('startDate') || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
  const endDate = req.nextUrl.searchParams.get('endDate') || new Date().toISOString().split('T')[0];

  const clients = await getAllValidOAuthClients();
  const results: Record<string, any> = {};

  for (const entry of clients) {
    console.log('GSC Client Domain:', entry.domain);
    if (entry.error) {
      results[entry.domain] = { error: entry.error };
      console.log('GSC Client Error:', entry.error);
      continue;
    }

    try {
      const searchconsole = google.searchconsole({ version: 'v1', auth: entry.oauth2Client });

      const response = await searchconsole.searchanalytics.query({
        siteUrl: entry.domain,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['page'],
        },
      });
      console.log('GSC Client Response:', response.data.rows);
      results[entry.domain] = response.data.rows || [];
    } catch (err: any) {
      results[entry.domain] = { error: err.message || 'Failed to fetch' };
      console.log('GSC Client Error:', err.message);
    }
  }

  return NextResponse.json(results);
}
