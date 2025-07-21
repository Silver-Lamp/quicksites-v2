import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import dns from 'dns/promises';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');

  if (!domain) return new NextResponse('Missing domain', { status: 400 });

  try {
    const txt = await dns.resolveTxt(`_verify.${domain}`);
    const flat = txt.flat().join('');
    if (flat.includes('quicksites')) {
      await supabase
        .from('templates')
        .update({ verified: true })
        .eq('custom_domain', domain);
      return NextResponse.json({ success: true });
    }
  } catch {
    // DNS error
  }

  return new NextResponse('Verification failed', { status: 404 });
}
