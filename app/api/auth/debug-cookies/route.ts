// app/api/auth/debug-cookies/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const store = await cookies();
  const all = store.getAll(); // ResponseCookie[]

  const cookieNames = all.map((c) => c.name);

  // Detect Supabase auth cookie(s). They can be chunked as: sb-...-auth-token.0, .1, ...
  const sbAuthCookies = all.filter(
    (c) => c.name.startsWith('sb-') && c.name.includes('-auth-token')
  );

  const chunkMatcher = /\.(\d+)$/;
  const chunked = sbAuthCookies.filter((c) => chunkMatcher.test(c.name));
  const baseName =
    (chunked[0]?.name ?? sbAuthCookies[0]?.name)?.replace(/\.\d+$/, '') ?? null;

  const chunks = chunked
    .map((c) => ({
      name: c.name,
      index: Number(c.name.match(chunkMatcher)?.[1] ?? 0),
      length: c.value.length,
    }))
    .sort((a, b) => a.index - b.index);

  const totalLength = sbAuthCookies.reduce((sum, c) => sum + c.value.length, 0);

  return NextResponse.json({
    cookieNames,
    supabaseAuthSummary: {
      present: sbAuthCookies.length > 0,
      baseName,
      chunked: chunked.length > 0,
      chunkCount:
        chunked.length || (sbAuthCookies.length > 0 ? 1 : 0),
      totalLength,
      chunks,
    },
  });
}
