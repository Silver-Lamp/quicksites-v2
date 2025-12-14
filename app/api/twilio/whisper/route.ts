// app/api/twilio/whisper/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Get the whisper message from query params or use default
  const url = new URL(req.url);
  const message = url.searchParams.get('message') || 
    'This is a lead from the Maple Valley Towing website.';

  // Return TwiML that says the whisper message
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">${message}</Say>
</Response>`;

  return new NextResponse(twiml, {
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}

