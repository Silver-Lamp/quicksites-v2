import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const domain = req.nextUrl.searchParams.get('domain'); // passed during auth start
  const userId = req.cookies.get('user_id')?.value; // or use Supabase session

  const redirectUri = 'https://quicksites.ai/api/gsc/oauth/callback';

  const oauth2Client = new google.auth.OAuth2(
    process.env.GSC_CLIENT_ID!,
    process.env.GSC_CLIENT_SECRET!,
    redirectUri
  );

  const { tokens } = await oauth2Client.getToken(code!);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('gsc_tokens')
    .upsert({
      domain,
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    }, { onConflict: 'domain' });

  if (error) console.error('❌ Failed to store GSC token:', error);

  return NextResponse.redirect(`/admin/sites/dashboard?gsc=connected&domain=${domain}`);
}
