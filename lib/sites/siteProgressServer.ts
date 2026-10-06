// lib/sites/siteProgressServer.ts
//
// Gather everything lib/sites/siteProgress.ts needs for ONE site, from the rows we already keep.
// Service-role reads; called by the new-site cron and by admin-gated routes only.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { analyzeSiteProgress, testTrafficReason, type SiteProgress, type SiteProgressInput, type TestTrafficReason } from '@/lib/sites/siteProgress';
import { resolveUserIdentity, type ResolvedIdentity } from '@/lib/admin/userIdentity';
import { alertRecipients } from '@/lib/ppl/callAlert';

export type SiteProgressReport = {
  template: {
    id: string;
    slug: string | null;
    business_name: string | null;
    industry: string | null;
    claim_source: string | null;
    created_at: string;
    owner_id: string | null;
  };
  identity: ResolvedIdentity;
  user: { id: string; email: string | null; is_anonymous: boolean; created_at: string | null; last_sign_in_at: string | null } | null;
  geo: { country: string | null; region: string | null; city: string | null } | null;
  progress: SiteProgress;
  testTraffic: TestTrafficReason;
};

export async function collectSiteProgress(templateId: string): Promise<SiteProgressReport | null> {
  const db = supabaseAdmin as any;
  const { data: t } = await db
    .from('templates')
    .select('id, slug, business_name, template_name, industry, claim_source, created_at, updated_at, saved_at, save_count, published, owner_id, data')
    .eq('id', templateId)
    .maybeSingle();
  if (!t) return null;

  const owner: string | null = t.owner_id ?? null;

  const [versions, lastVersion, ai, funnel, authUser, geo, adminRow] = await Promise.all([
    db.from('template_versions').select('id', { count: 'exact', head: true }).eq('template_id', t.id),
    db.from('template_versions').select('saved_at').eq('template_id', t.id).order('saved_at', { ascending: false }).limit(1),
    owner ? db.from('ai_usage_events').select('occurred_at, cost_usd').eq('user_id', owner) : Promise.resolve({ data: [] }),
    owner ? db.from('guest_upgrade_events').select('event, created_at').eq('guest_user_id', owner) : Promise.resolve({ data: [] }),
    owner ? supabaseAdmin.auth.admin.getUserById(owner).catch(() => ({ data: { user: null } })) : Promise.resolve({ data: { user: null } }),
    owner ? db.from('user_signup_geo').select('country, region, city').eq('user_id', owner).maybeSingle() : Promise.resolve({ data: null }),
    owner ? db.from('admin_users').select('user_id').eq('user_id', owner).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const aiRows: Array<{ occurred_at: string; cost_usd: number | null }> = ai?.data ?? [];
  const u = (authUser as any)?.data?.user ?? null;
  const user = u
    ? { id: u.id as string, email: (u.email as string | null) ?? null, is_anonymous: !!u.is_anonymous, created_at: (u.created_at as string | null) ?? null, last_sign_in_at: (u.last_sign_in_at as string | null) ?? null }
    : null;

  const input: SiteProgressInput = {
    template: t,
    versions: versions?.count ?? 0,
    lastVersionAt: lastVersion?.data?.[0]?.saved_at ?? null,
    aiCalls: aiRows.length,
    aiCostUsd: aiRows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0),
    lastAiAt: aiRows.map((r) => r.occurred_at).sort().slice(-1)[0] ?? null,
    funnel: funnel?.data ?? [],
    user,
  };

  const identity = resolveUserIdentity({ authEmail: user?.email ?? null, siteBusinessName: t.business_name ?? t.template_name ?? null });

  return {
    template: { id: t.id, slug: t.slug ?? null, business_name: t.business_name ?? t.template_name ?? null, industry: t.industry ?? null, claim_source: t.claim_source ?? null, created_at: t.created_at, owner_id: owner },
    identity,
    user,
    geo: geo?.data ?? null,
    progress: analyzeSiteProgress(input),
    testTraffic: testTrafficReason({ businessName: t.business_name, userEmail: user?.email, isAdminUser: !!adminRow?.data, adminEmails: alertRecipients() }),
  };
}
