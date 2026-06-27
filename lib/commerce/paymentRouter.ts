import { StripeAdapter } from './adapters/stripeAdapter';
import { PaymentsAdapter } from './paymentAdapter';
import { CreateCheckoutParams } from './types';
import { getServerSupabase } from '@/lib/supabase/server'; // your helper



export async function getMerchantPaymentProvider(merchantId: string) {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('payment_accounts')
    .select('provider, account_ref, status')
    .eq('merchant_id', merchantId).eq('status', 'active').limit(1).single();
  if (error || !data) throw new Error('No active payment account for merchant');
  return data.provider as keyof typeof adapters;
}

const adapters: Record<string, PaymentsAdapter> = {
  stripe: new StripeAdapter(),
  // paypal: new PaypalAdapter(),
  // square: new SquareAdapter(),
};

type PaymentConfig = {
  provider: 'stripe' | 'paypal' | 'square' | 'authorize_net' | 'custom';
  account_ref: string | null;
  collect_platform_fee: boolean;
  platform_fee_percent: number;     // 0..1
  platform_fee_min_cents: number;   // int
};

export async function getMerchantPaymentConfig(merchantId: string): Promise<PaymentConfig> {
    const supabase = await getServerSupabase({ serviceRole: true });
    const { data, error } = await supabase
      .from('payment_accounts')
      .select('provider, account_ref, collect_platform_fee, platform_fee_percent, platform_fee_min_cents, status')
      .eq('merchant_id', merchantId).eq('status', 'active').limit(1).single();
    if (error || !data) throw new Error('No active payment account for merchant');
    return {
      provider: data.provider as PaymentConfig['provider'],
      account_ref: data.account_ref,
      collect_platform_fee: !!data.collect_platform_fee,
      platform_fee_percent: Number(data.platform_fee_percent || 0),
      platform_fee_min_cents: Number(data.platform_fee_min_cents || 0),
    };
  }
  
  /**
   * Like getMerchantPaymentConfig, but never throws when a merchant has no active
   * payment account (unconfigured / test merchant). Returns a 'custom' provider
   * config so an order can still be drafted. Set QS_TEST_PLATFORM_FEE_PERCENT
   * (e.g. 0.05) to exercise platform-fee math without a configured Stripe account.
   */
  export async function getMerchantPaymentConfigSafe(merchantId: string): Promise<PaymentConfig> {
    try {
      return await getMerchantPaymentConfig(merchantId);
    } catch {
      const testFee = Number(process.env.QS_TEST_PLATFORM_FEE_PERCENT ?? '0') || 0;
      return {
        provider: 'custom',
        account_ref: null,
        collect_platform_fee: testFee > 0,
        platform_fee_percent: testFee,
        platform_fee_min_cents: 0,
      };
    }
  }

  function computePlatformFee(totalCents: number, cfg: PaymentConfig) {
    if (!cfg.collect_platform_fee) return 0;
    const pct = Math.floor(totalCents * (cfg.platform_fee_percent || 0));
    return Math.max(pct, cfg.platform_fee_min_cents || 0);
  }

export async function createCheckout(merchantId: string, p: Omit<CreateCheckoutParams, 'platformFeeCents'|'connectAccountId'>) {
    const cfg = await getMerchantPaymentConfig(merchantId);
    const adapter = adapters[cfg.provider];
    if (!adapter) throw new Error(`No adapter for ${cfg.provider}`);
  
    const total = p.lineItems.reduce((s, li) => s + li.unitAmount * li.quantity, 0);
    const platformFeeCents = computePlatformFee(total, cfg);
    const connectAccountId = (cfg.provider === 'stripe') ? cfg.account_ref : null;
  
    return adapter.createCheckout({
      ...p,
      platformFeeCents,
      connectAccountId,
    });
  }

export function adapterFor(provider: string): PaymentsAdapter | null {
  return adapters[provider] ?? null;
}
