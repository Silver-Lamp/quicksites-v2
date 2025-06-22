// ✅ FILE: app/api/readme/route.ts

export const runtime = 'nodejs';

import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), 'README.md');
    const markdown = fs.readFileSync(filePath, 'utf8');
    const html = marked(markdown);

    return new Response(html as string, {
      headers: { 'Content-Type': 'text/html' },
      status: 200,
    });
  } catch (err: unknown) {
    return new Response(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, { status: 500 });
  }
}
