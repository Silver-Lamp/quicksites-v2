'use client';

import * as React from 'react';
import CartButton from './cart-button';

export default function CartFab() {
  return (
    <div className="fixed bottom-4 right-4 z-40 md:hidden">
      <CartButton hideWhenEmpty={false} />
    </div>
  );
}
