// app/api/cheer/route.ts
// Use cheer() when you need to cheer a block
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
    const token = req.headers.get('authorization')?.replace('Bearer ', '')?.trim();
    if (!token) {
      return Response.json(
        { error: 'Missing token' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { block_id, message } = await req.json();
    if (!block_id) {
      return Response.json(
        { error: 'Missing block_id' },
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

    const { error: insertError } = await supabase.from('block_feedback').insert({
      block_id,
      user_id: user.id,
      action: 'cheer',
      message: message || null,
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
    console.error('[❌ Unexpected Cheer Error]', err);
    return Response.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
