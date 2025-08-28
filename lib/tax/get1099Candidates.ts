import { getServerSupabase } from '@/lib/supabase/server';

export type Candidate = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  total_cents: number;
  methods: string[];
  entity_type: string | null;
  tin_status: string | null;
  backup_withholding: boolean;
  address: {
    name: string | null;
    business: string | null;
    address1: string | null;
    address2: string | null;
    city: string | null;
    region: string | null;
    postal_code: string | null;
    country: string | null;
  };
};

export async function get1099Candidates(taxYear: number, {
  thresholdCents = 60000,           // $600
  includeCorps = false,             // IRS generally excludes C/S corps (except attorneys)
}: { thresholdCents?: number; includeCorps?: boolean; }): Promise<Candidate[]> {
  const svc = await getServerSupabase({ serviceRole: true });

  // Sum non-TPSO payouts per user/year
  const { data: sums, error } = await svc
    .from('affiliate_payouts')
    .select('affiliate_user_id, amount_cents, method')
    .eq('tax_year', taxYear)
    .eq('is_tpso', false); // only payments you report
  if (error) throw error;

  const totals = new Map<string, { amount: number; methods: Set<string> }>();
  for (const r of (sums || [])) {
    const t = totals.get(r.affiliate_user_id) || { amount: 0, methods: new Set<string>() };
    t.amount += Number(r.amount_cents || 0);
    t.methods.add(r.method);
    totals.set(r.affiliate_user_id, t);
  }

  if (totals.size === 0) return [];

  // pull tax profiles + emails
  const userIds = Array.from(totals.keys());
  const [{ data: profiles }, { data: accounts }] = await Promise.all([
    svc.from('affiliate_tax_profiles')
       .select('user_id, entity_type, tin_status, backup_withholding, legal_name, business_name, address1,address2,city,region,postal_code,country')
       .in('user_id', userIds),
    svc.from('profiles')
       .select('id, email, display_name')
       .in('id', userIds),
  ]);

  const profileByUser = new Map((profiles || []).map(p => [p.user_id, p]));
  const accountByUser = new Map((accounts || []).map(a => [a.id, a]));

  const out: Candidate[] = [];
  for (const uid of userIds) {
    const t = totals.get(uid)!;
    if (t.amount < thresholdCents) continue;

    const tp = profileByUser.get(uid) || {};
    const entity = (tp as any).entity_type as string | undefined;
    const isCorp = entity === 'c_corp' || entity === 's_corp';
    if (isCorp && !includeCorps) continue;

    const acct = accountByUser.get(uid) || {};
    out.push({
      user_id: uid,
      email: (acct as any).email ?? null,
      display_name: (acct as any).display_name ?? null,
      total_cents: t.amount,
      methods: Array.from(t.methods),
      entity_type: entity ?? null,
      tin_status: (tp as any).tin_status ?? null,
      backup_withholding: !!(tp as any).backup_withholding,
      address: {
        name: (tp as any).legal_name ?? null,
        business: (tp as any).business_name ?? null,
        address1: (tp as any).address1 ?? null,
        address2: (tp as any).address2 ?? null,
        city: (tp as any).city ?? null,
        region: (tp as any).region ?? null,
        postal_code: (tp as any).postal_code ?? null,
        country: (tp as any).country ?? 'US',
      },
    });
  }
  return out.sort((a,b)=>b.total_cents - a.total_cents);
}
