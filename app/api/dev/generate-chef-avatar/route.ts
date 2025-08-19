// app/api/dev/generate-chef-avatar/route.ts
// Back-compat shim: forwards to the hardened chef avatar route and
// returns both { url } and { imageUrl } so older callers keep working.


import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


// Re-use the production handler logic
import { POST as chefGenerateAvatar } from '@/app/api/chef/profile/generate-avatar/route';


export async function POST(req: Request) {
// Delegate to the main route
const upstream = await chefGenerateAvatar(req);
const status = upstream.status;


let data: any = null;
try {
data = await upstream.json();
} catch {
// fall through
}


if (!upstream.ok) {
return NextResponse.json(data ?? { error: 'Avatar generation failed' }, { status });
}


// Ensure older clients that expect `imageUrl` still get a value.
const url = data?.url ?? data?.imageUrl ?? data?.dataUrl ?? '';
const payload = {
...data,
url,
imageUrl: data?.imageUrl ?? url,
};
return NextResponse.json(payload, { status });
}