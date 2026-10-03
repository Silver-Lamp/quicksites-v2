// app/login/page.tsx
import LoginForm from './LoginForm';
import { getEnabledAuthProviders } from '@/lib/auth/authProviders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Which methods are live is read from Supabase at request time (cached five minutes), so
  // enabling Google in the dashboard is the whole rollout — no flag, no redeploy.
  const providers = await getEnabledAuthProviders();
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? '';
  const short = sha ? sha.slice(0, 7) : 'dev';
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown';
  const deployId = process.env.VERCEL_DEPLOYMENT_ID ?? '';

  const build = {
    sha: short,
    env,
    deployId,
  };

  return <LoginForm build={build} providers={providers} />;
}
