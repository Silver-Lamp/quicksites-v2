export const runtime = 'nodejs';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export async function GET() {
  try {
    const spec = readFileSync(join(process.cwd(), 'openapi.json'), 'utf8');
    return new Response(spec, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to load openapi.json' }),
      { status: 500 }
    );
  }
}
