// lib/stripe/createCheckoutSession.ts
export async function createCheckoutSession({
    domain,
    email,
    coupon,
  }: {
    domain: string;
    email: string;
    coupon?: string;
  }) {
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, email, coupon }),
    });
  
    return res.json();
  }
  