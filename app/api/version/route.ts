import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    sha: (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? '').slice(0,7),
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    deployId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    url: process.env.VERCEL_URL ?? null,
  });
}
