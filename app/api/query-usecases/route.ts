import { NextResponse } from 'next/server';
import { loadQueryUsecases } from '@/scripts/load-query-usecases';

export async function GET() {
  const files = loadQueryUsecases();
  return NextResponse.json({ files });
}
