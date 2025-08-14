// /lib/refunds.ts
// import { Environment, Client } from 'square';

type RefundInput = {
    paymentId: string;           // Stripe PI or Square paymentId
    amountCents: number;         // integer cents
    idempotencyKey: string;
  };
  
  export async function issueRefund(input: RefundInput & { provider: 'stripe' | 'square' }): Promise<{ providerRefundId: string }> {
    if (input.provider === 'stripe') {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any });
      const r = await stripe.refunds.create(
        { payment_intent: input.paymentId, amount: input.amountCents },
        { idempotencyKey: input.idempotencyKey }
      );
      return { providerRefundId: r.id };
    }
  
    // if (input.provider === 'square') {
    //   const client = new Client({
    //     accessToken: process.env.SQUARE_ACCESS_TOKEN!,
    //     environment: process.env.NODE_ENV === 'production' ? Environment.Production : Environment.Sandbox
    //   });
    //   const resp = await client.refundsApi.refundPayment({
    //     idempotencyKey: input.idempotencyKey,
    //     amountMoney: { amount: BigInt(input.amountCents), currency: 'USD' },
    //     paymentId: input.paymentId
    //   });
    //   const id = resp.result.refund?.id;
    //   if (!id) throw new Error('Square refund failed');
    //   return { providerRefundId: String(id) };
    // }
  
    throw new Error('Unsupported provider');
  }
  
  export async function issueRefund2(input: RefundInput & { provider: 'stripe' }): Promise<{ providerRefundId: string }> {
    if (input.provider === 'stripe') {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any });
      const r = await stripe.refunds.create(
        { payment_intent: input.paymentId, amount: input.amountCents },
        { idempotencyKey: input.idempotencyKey }
      );
      return { providerRefundId: r.id };
    }
  
    // if (input.provider === 'square') {
    //   const client = new Client({
    //     accessToken: process.env.SQUARE_ACCESS_TOKEN!,
    //     environment: process.env.NODE_ENV === 'production' ? Environment.Production : Environment.Sandbox
    //   });
    //   const resp = await client.refundsApi.refundPayment({
    //     idempotencyKey: input.idempotencyKey,
    //     amountMoney: { amount: BigInt(input.amountCents), currency: 'USD' },
    //     paymentId: input.paymentId
    //   });
    //   const id = resp.result.refund?.id;
    //   if (!id) throw new Error('Square refund failed');
    //   return { providerRefundId: String(id) };
    // }
  
    throw new Error('Unsupported provider');
  }
  
  