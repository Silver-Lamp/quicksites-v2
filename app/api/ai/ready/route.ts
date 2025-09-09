// app/api/ai/ready/route.ts
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function GET() {
  const ok = Boolean(process.env.OPENAI_API_KEY /* || process.env.ANTHROPIC_API_KEY */);
  return NextResponse.json({ ok });
}
