import ResetClient from './reset-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reset password', robots: { index: false } };

// Landing page for the "forgot password" email link. Supabase redirects here with a
// recovery token in the URL fragment (implicit flow); the client establishes the
// recovery session, takes a new password, then finalizes server cookies.
export default function ResetPasswordPage() {
  return <ResetClient />;
}
