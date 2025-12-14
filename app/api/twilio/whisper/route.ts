// app/api/twilio/whisper/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Escape XML special characters
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function handleRequest(req: Request) {
  // Get the whisper message from query params, form data, or use default
  const url = new URL(req.url);
  let message = url.searchParams.get('message');
  
  // If not in query params, try form data (Twilio may send POST)
  if (!message && req.method === 'POST') {
    const text = await req.text();
    const params = new URLSearchParams(text);
    message = params.get('message');
  }
  
  // Fallback to default message
  message = message || 'This is a lead from the Maple Valley Towing website.';

  // Escape XML special characters
  const escapedMessage = escapeXml(message);

  // Return TwiML that says the whisper message
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">${escapedMessage}</Say>
</Response>`;

  return new NextResponse(twiml, {
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}

export async function GET(req: Request) {
  return handleRequest(req);
}

export async function POST(req: Request) {
  return handleRequest(req);
}

