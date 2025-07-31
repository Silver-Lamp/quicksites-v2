// app/api/stripe/stripe-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil' as Stripe.LatestApiVersion,
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature error:', err);
    return new NextResponse('Webhook Error', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const domain = session.metadata?.domain;
    const email = session.customer_email;

    if (domain && email) {
      const { data: template } = await supabaseAdmin
        .from('templates')
        .select('id')
        .eq('custom_domain', domain)
        .single();

      const templateId = template?.id;

      let leadId: string | null = null;

      if (templateId) {
        // Update template
        await supabaseAdmin
          .from('templates')
          .update({
            claimed_by: email,
            claimed_at: new Date().toISOString(),
            claim_source: 'stripe_checkout',
          })
          .eq('id', templateId);

        // Match lead
        const { data: matchedLead } = await supabaseAdmin
          .from('leads')
          .select('id')
          .eq('email', email)
          .eq('domain_id', templateId)
          .maybeSingle();

        if (matchedLead?.id) {
          leadId = matchedLead.id;

          await supabaseAdmin
            .from('leads')
            .update({ outreach_status: 'claimed' })
            .eq('id', leadId);
        }

        // Log action
        await supabaseAdmin.from('user_action_logs').insert({
          action_type: 'claim_checkout_completed',
          triggered_by: email,
          lead_id: leadId,
          domain_id: templateId,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
