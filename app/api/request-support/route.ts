// app/api/request-support/route.ts
// Use requestSupport() when you need to request support
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
    const { receiver_handle, slug, message } = await req.json();

    if (!token || !receiver_handle) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
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

    const { error: insertError } = await supabase.from('support_requests').insert({
      requester_id: user.id,
      receiver_handle,
      slug,
      message,
    });

    if (insertError) {
      console.error('[❌ Insert Error]', insertError.message);
      return Response.json(
        { error: insertError.message },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return Response.json({ success: true }, { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[❌ Unexpected Error]', err);
    return Response.json(
      { error: err?.message || 'Unknown server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
