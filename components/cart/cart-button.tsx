'use client';

import * as React from 'react';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/components/cart/cart-store';

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function readEcomEnabled(): boolean {
  try {
    const snap = (window as any).__QS_ECOM__;
    if (snap?.merchantId || snap?.email) return true;

    const tpl =
      (window as any).__QS_TPL_REF__?.current ??
      (window as any).__QS_TEMPLATE__ ??
      null;
    const data = tpl?.data ?? {};
    const metaE = data?.meta?.ecom ?? data?.meta?.ecommerce ?? {};

    return Boolean(
      metaE?.merchant_id ||
      metaE?.merchant_email ||
      data?.ecommerce?.merchant_id ||
      data?.ecommerce?.merchant_email ||
      data?.merchant_email
    );
  } catch {
    return false;
  }
}

export default function CartButton({
  className = '',
  hideWhenEmpty = true,
}: {
  className?: string;
  hideWhenEmpty?: boolean;
}) {
  // ✅ Select primitives/arrays directly to avoid getServerSnapshot loops
  const items = useCartStore((s) => s.items);
  const count = React.useMemo(() => items.reduce((n, i) => n + i.qty, 0), [items]);

  const [enabled, setEnabled] = React.useState(false);
  const [bump, setBump] = React.useState(false);

  React.useEffect(() => {
    setEnabled(readEcomEnabled());
  }, []);

  // Bump on add-to-cart
  React.useEffect(() => {
    const onAdd = () => {
      setBump(true);
      const t = setTimeout(() => setBump(false), 300);
      return () => clearTimeout(t);
    };
    const h = onAdd as EventListener;
    window.addEventListener('qs:cart:add', h);
    return () => window.removeEventListener('qs:cart:add', h);
  }, []);

  if ((!enabled && !count) || (hideWhenEmpty && !count)) return null;

  return (
    <Link
      href="/cart"
      className={clsx(
        'relative inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition',
        bump && 'scale-105',
        className
      )}
      aria-label={`Cart${count ? `, ${count} item${count > 1 ? 's' : ''}` : ''}`}
    >
      <ShoppingCart className="h-4 w-4" />
      {count > 0 && (
        <span
          className="absolute -right-2 -top-2 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground leading-none"
          aria-hidden="true"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
