// app/api/twilio/forward-with-whisper/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Get the destination number from query params or use default
  const url = new URL(req.url);
  const to = url.searchParams.get('to') || '+12623028118';
  
  // Get the whisper message (optional, can be customized)
  const whisperMessage = url.searchParams.get('whisper') || 
    'This is a lead from the Maple Valley Towing website.';

  // Return TwiML that forwards with whisper
  const whisperUrl = `https://www.quicksites.ai/api/twilio/whisper?message=${encodeURIComponent(whisperMessage)}`;
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial 
        record="record-from-answer-dual"
        answerOnBridge="true"
        action="https://www.quicksites.ai/api/twilio-callback"
        method="POST"
        recordingStatusCallback="https://www.quicksites.ai/api/twilio-callback"
        recordingStatusCallbackMethod="POST">
        <Number url="${whisperUrl}">${to}</Number>
    </Dial>
</Response>`;

  return new NextResponse(twiml, {
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}

