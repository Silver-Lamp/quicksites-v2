export function codeGen(prefix = 'DM'): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = ''; for (let i=0;i<8;i++) s += alphabet[Math.floor(Math.random()*alphabet.length)];
    return `${prefix}${s}`; // e.g., DMQ8K7ZP2
  }
  
  export type Coupon = {
    id:string; merchant_id:string; user_id:string|null; status:string;
    type:'percent'|'fixed'; percent?:number|null; amount_cents?:number|null;
    min_subtotal_cents:number; currency:string; expires_at?:string|null; uses_allowed:number; uses_count:number;
  };
  
  export function computeDiscount(subtotalCents: number, c: Coupon): number {
    if (c.status !== 'active') return 0;
    if (c.expires_at && new Date(c.expires_at) < new Date()) return 0;
    if (c.uses_count >= c.uses_allowed) return 0;
    if (subtotalCents < (c.min_subtotal_cents || 0)) return 0;
  
    let d = 0;
    if (c.type === 'percent' && c.percent) d = Math.floor(subtotalCents * c.percent / 100);
    if (c.type === 'fixed' && c.amount_cents) d = c.amount_cents;
    d = Math.max(0, Math.min(d, subtotalCents)); // never exceed subtotal
    return d;
  }
  