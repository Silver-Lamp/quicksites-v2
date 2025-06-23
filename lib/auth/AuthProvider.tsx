'use client';

import { AuthProvider } from './AuthContext';

export default function WithAuth({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
