import { NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { get1099Candidates } from '@/lib/tax/get1099Candidates';

function dollars(cents:number){ return (cents/100).toFixed(2); }

async function requireAdmin() {
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) throw new Error('unauthorized');
  const { data: profile } = await supa.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  const isAdmin = (u.user.user_metadata?.role === 'admin') || profile?.role === 'admin';
  if (!isAdmin) throw new Error('forbidden');
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const year = Number(url.searchParams.get('year') || new Date().getUTCFullYear());

    const candidates = await get1099Candidates(year, { thresholdCents: 60000, includeCorps: false });

    // Basic 1099-NEC column set commonly accepted by e-file tools / IRIS mapping
    const header = [
      'payer_name','payer_tin','payer_phone','payer_address1','payer_city','payer_state','payer_zip',
      'recipient_name','recipient_business','recipient_tin_last4','recipient_address1','recipient_address2',
      'recipient_city','recipient_state','recipient_zip','recipient_country',
      'recipient_account_number','nonemployee_compensation','federal_income_tax_withheld','tax_year'
    ];

    const payer = {
      name: process.env.PAYER_NAME || '',
      tin: process.env.PAYER_TIN || '',
      phone: process.env.PAYER_PHONE || '',
      addr1: process.env.PAYER_ADDRESS1 || '',
      city: process.env.PAYER_CITY || '',
      state: process.env.PAYER_STATE || '',
      zip: process.env.PAYER_ZIP || '',
    };

    const lines = [header.join(',')];
    for (const c of candidates) {
      const row = [
        payer.name, payer.tin, payer.phone, payer.addr1, payer.city, payer.state, payer.zip,
        (c.address.name || ''), (c.address.business || ''), '', // we only store last4 if collected; leave blank if not
        (c.address.address1 || ''), (c.address.address2 || ''), (c.address.city || ''), (c.address.region || ''), (c.address.postal_code || ''), (c.address.country || 'US'),
        c.user_id,                                                 // account number field
        dollars(c.total_cents),                                    // NEC Box 1 amount
        c.backup_withholding ? dollars(Math.round(c.total_cents*0.24)) : '0.00', // if you tracked actual withheld, replace this calc
        String(year),
      ].map(v => String(v).replace(/,/g,' ')); // naive comma scrub for CSV
      lines.push(row.join(','));
    }

    const csv = lines.join('\n');
    return new Response(csv, {
      status: 200,
      headers: {
        'content-type':'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="1099NEC_IRIS_${year}.csv"`
      }
    });
  } catch (e:any) {
    const msg = e?.message || 'error';
    const code = msg === 'unauthorized' ? 401 : msg === 'forbidden' ? 403 : 400;
    return new Response(msg, { status: code });
  }
}
