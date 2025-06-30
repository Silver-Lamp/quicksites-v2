// app/login/page.tsx
import { sessionGuard } from '@/lib/guards/sessionGuard';
import LoginClient from './login-client';

export default async function LoginPage() {
  await sessionGuard('/admin/dashboard'); // ⬅️ SSR redirect if already logged in

  return <LoginClient />;
}
