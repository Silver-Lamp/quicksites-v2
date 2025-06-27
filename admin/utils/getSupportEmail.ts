import type { User } from '@supabase/supabase-js';

export function getSupportEmail(user?: User | null): string {
  return (
    user?.app_metadata?.org_support_email ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    'support@example.com'
  );
}
