// app/api/send-thanks/route.ts
// Use sendThanks() when you need to send a thank you note
// Use getUserFromRequest() when you need the user context

export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')?.trim();
    const { recipient_id, block_id, message } = await req.json();

    if (!token || !recipient_id || !block_id || !message) {
      return Response.json(
        { error: 'Missing fields: token, recipient_id, block_id, or message' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user?.id) {
      console.warn('[❌ Auth Error]', authError?.message);
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { error: insertError } = await supabase.from('thank_you_notes').insert({
      sender_id: user.id,
      recipient_id,
      block_id,
      message,
    });

    if (insertError) {
      console.error('[❌ Insert Error]', insertError.message);
      return Response.json(
        { error: insertError.message },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return Response.json({ success: true }, { headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[❌ Unexpected sendThanks Error]', err);
    return Response.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
