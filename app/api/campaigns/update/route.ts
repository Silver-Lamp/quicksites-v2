// app/api/campaigns/update/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[📥 Update Request Payload]', body);
    const { id, name, city, state, industry, starts_at, ends_at, lead_ids, status } = body;

    if (!id) return NextResponse.json({ error: 'Missing campaign id' }, { status: 400 });

    const { data: updated, error: updateError } = await supabase
      .from('campaigns')
      .update({ name, city, state, industry, starts_at, ends_at, status })
      .eq('id', id)
      .select()
      .single();

    console.log('[✅ After Update]', updated);

    if (updateError) {
      console.error('[❌ Update Campaign]', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (Array.isArray(lead_ids)) {
      const { error: linkError } = await supabase
        .from('campaign_leads')
        .delete()
        .eq('campaign_id', id);

      if (linkError) {
        console.error('[❌ Delete Existing Links]', linkError);
      }

      const newLinks = lead_ids.map((lead_id) => ({ campaign_id: id, lead_id }));
      const { error: insertError } = await supabase.from('campaign_leads').insert(newLinks);

      if (insertError) {
        console.error('[❌ Insert New Links]', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[❌ API Error]', err);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}
