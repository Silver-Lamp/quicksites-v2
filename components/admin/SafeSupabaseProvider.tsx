'use client';

import { useEffect, useState } from 'react';
import SupabaseProvider from './SupabaseProvider';

export default function SafeSupabaseProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return <SupabaseProvider>{children}</SupabaseProvider>;
}
