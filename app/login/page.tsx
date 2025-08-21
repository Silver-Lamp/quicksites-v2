// app/login/page.tsx
import LoginForm from './LoginForm';

export const runtime = 'nodejs';
// optional if you want it recomputed every request:
// export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? '';
  const short = sha ? sha.slice(0, 7) : 'dev';
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown';
  const deployId = process.env.VERCEL_DEPLOYMENT_ID ?? '';

  const build = {
    sha: short,
    env,
    deployId,
  };

  return (
    <LoginForm
      build={build}
    />
  );
}
