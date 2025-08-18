// app/api/_debug/cookies/route.ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
export async function GET() {
  const store = await cookies();
  return NextResponse.json({ names: store.getAll().map(c => c.name) });
}
