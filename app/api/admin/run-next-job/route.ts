// ✅ FILE: app/api/admin/run-next-job/route.ts
export const runtime = 'nodejs';

import { exec } from 'child_process';
import { promisify } from 'util';
import { NextRequest } from 'next/server';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { command } = await req.json();

    if (!command || typeof command !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid command' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { stdout, stderr } = await execAsync(command);
    return new Response(JSON.stringify({ stdout, stderr }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
