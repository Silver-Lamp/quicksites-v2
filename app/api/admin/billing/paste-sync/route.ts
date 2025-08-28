import { NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
// import Stripe from 'stripe';
// import { STRIPE_API_VERSION } from '@/lib/stripe/server';
import { stripe } from '@/lib/stripe/server';
type RowInput =
  | { merchant_id?: string; email?: string; site_slug?: string; customer_id: string }
  | string; // a raw line like "email@example.com, cus_123" or "merchant_uuid  cus_123"

function looksLikeUUID(s: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s); }
function looksLikeEmail(s: string) { return /@/.test(s) && !/\s/.test(s); }

async function requireAdmin() {
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) throw new Error('unauthorized');
  const { data: profile } = await supa.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  const isAdmin = (u.user.user_metadata?.role === 'admin') || profile?.role === 'admin';
  if (!isAdmin) throw new Error('forbidden');
  return { supa, user: u.user };
}

function parseLines(text: string): { left: string; customer: string }[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out: { left: string; customer: string }[] = [];
  for (const line of lines) {
    if (line.startsWith('#')) continue;
    // Try CSV, then TSV/space, then pipe
    let parts = line.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) parts = line.split(/\s+/).map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) parts = line.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const left = parts[0];
      const customer = parts[1];
      out.push({ left, customer });
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const svc = await getServerSupabase({ serviceRole: true });

    const contentType = req.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await req.json() : { text: await req.text() };

    const syncFromStripe = !!(body.syncFromStripe ?? false);
    const createOnly = body.createOnly !== false; // default true

    // Build inputs list
    const inputs: Array<{ merchant_id?: string; email?: string; site_slug?: string; customer_id: string }> = [];
    if (Array.isArray(body.pairs)) {
      for (const p of body.pairs as RowInput[]) {
        if (typeof p === 'string') {
          const parsed = parseLines(p);
          parsed.forEach(it => inputs.push({ customer_id: it.customer, ...(looksLikeUUID(it.left) ? { merchant_id: it.left } : looksLikeEmail(it.left) ? { email: it.left } : { site_slug: it.left }) }));
        } else if (p && typeof p === 'object' && p.customer_id) {
          inputs.push(p as any);
        }
      }
    } else if (typeof body.text === 'string') {
      const parsed = parseLines(body.text);
      parsed.forEach(it => inputs.push({ customer_id: it.customer, ...(looksLikeUUID(it.left) ? { merchant_id: it.left } : looksLikeEmail(it.left) ? { email: it.left } : { site_slug: it.left }) }));
    } else {
      return new Response(JSON.stringify({ error: 'provide text or pairs' }), { status: 400 });
    }

    // const key = process.env.STRIPE_SECRET_KEY;
    // const stripe = syncFromStripe && key ? new Stripe(key, { apiVersion: STRIPE_API_VERSION }) : null;

    const results: Array<{
      input: any;
      merchant_id?: string;
      customer_id?: string;
      subscription_id?: string | null;
      plan?: string | null;
      price_cents?: number | null;
      status: 'created' | 'skipped_exists' | 'not_found' | 'error';
      message?: string;
    }> = [];

    // Helper lookups
    async function resolveMerchantId(tok: { merchant_id?: string; email?: string; site_slug?: string }): Promise<string | null> {
      if (tok.merchant_id && looksLikeUUID(tok.merchant_id)) return tok.merchant_id;
      if (tok.email) {
        const { data: owner } = await svc.from('profiles').select('id').ilike('email', tok.email).maybeSingle();
        if (!owner?.id) return null;
        const { data: merchants } = await svc.from('merchants').select('id').eq('owner_id', owner.id).order('created_at', { ascending: false }).limit(1);
        return merchants?.[0]?.id || null;
      }
      if (tok.site_slug) {
        const { data: m } = await svc.from('merchants').select('id').eq('site_slug', tok.site_slug).maybeSingle();
        return m?.id || null;
      }
      return null;
    }

    for (const inp of inputs) {
      try {
        const merchantId = await resolveMerchantId(inp);
        if (!merchantId) {
          results.push({ input: inp, status: 'not_found', message: 'merchant not found' });
          continue;
        }

        // existing mapping?
        const { data: existing } = await svc.from('merchant_billing').select('merchant_id, stripe_customer_id, stripe_subscription_id, plan, price_cents').eq('merchant_id', merchantId).maybeSingle();
        if (existing && createOnly) {
          results.push({ input: inp, merchant_id: merchantId, customer_id: inp.customer_id, status: 'skipped_exists', message: 'mapping exists' });
          continue;
        }

        let subId: string | null = null;
        let plan: string | null = null;
        let priceCents: number | null = null;

        if (stripe) {
          // Pull latest subscription for the customer
          const list = await stripe.subscriptions.list({ customer: inp.customer_id, status: 'all', limit: 1 });
          const sub = list.data[0] || null;
          subId = sub?.id || null;
          const price = sub?.items.data[0]?.price;
          priceCents = typeof price?.unit_amount === 'number' ? price.unit_amount : null;
          plan = price?.nickname || (price?.lookup_key as string | null) || null;
          if (!plan && typeof price?.product === 'string') {
            try {
              const prod = await stripe.products.retrieve(price!.product as string);
              plan = prod.name || null;
            } catch {}
          }
        }

        const patch: any = {
          merchant_id: merchantId,
          stripe_customer_id: inp.customer_id,
          stripe_subscription_id: subId,
          plan: plan || (existing?.plan ?? 'Pro'),
          price_cents: priceCents ?? (existing?.price_cents ?? 0),
          updated_at: new Date().toISOString(),
        };

        const { error } = await svc.from('merchant_billing').upsert(patch, { onConflict: 'merchant_id' });
        if (error) throw new Error(error.message);

        results.push({
          input: inp,
          merchant_id: merchantId,
          customer_id: inp.customer_id,
          subscription_id: subId,
          plan: patch.plan,
          price_cents: patch.price_cents,
          status: existing ? 'created' : 'created',
        });
      } catch (e:any) {
        results.push({ input: inp, status: 'error', message: e?.message || 'unknown error' });
      }
    }

    const summary = {
      total: results.length,
      created: results.filter(r => r.status === 'created').length,
      skipped_exists: results.filter(r => r.status === 'skipped_exists').length,
      not_found: results.filter(r => r.status === 'not_found').length,
      error: results.filter(r => r.status === 'error').length,
    };

    return new Response(JSON.stringify({ ok: true, summary, results }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e:any) {
    const msg = e?.message || 'error';
    const code = msg === 'unauthorized' ? 401 : msg === 'forbidden' ? 403 : 400;
    return new Response(JSON.stringify({ error: msg }), { status: code, headers: { 'content-type': 'application/json' } });
  }
}
