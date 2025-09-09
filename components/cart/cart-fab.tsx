// components/cart/cart-fab.tsx
'use client';

import * as React from 'react';
import CartButton from './cart-button';

export default function CartFab({ className = '' }: { className?: string }) {
  return (
    <div className={['fixed bottom-4 right-4 z-50', className].filter(Boolean).join(' ')}>
      {/* Keep it visible even when empty; CartButton will still hide if e-com truly disabled */}
      <CartButton hideWhenEmpty={false} />
    </div>
  );
}
