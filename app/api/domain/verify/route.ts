import { NextResponse } from 'next/server';
import { verifyAndConfigureDomain } from '@/lib/namecheap/verifyAndConfigureDomain';

export async function POST(req: Request) {
  const { domain } = await req.json();
  if (!domain) return new NextResponse('Missing domain', { status: 400 });

  try {
    const result = await verifyAndConfigureDomain(domain);
    return NextResponse.json(result);
  } catch (err) {
    return new NextResponse(`Verification failed: ${err}`, { status: 500 });
  }
}
