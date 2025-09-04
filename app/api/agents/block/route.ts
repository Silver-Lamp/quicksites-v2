// app/api/agents/block/route.ts
// Runs qs-block-agent.ts with provided args
// ===============================
import { NextRequest } from 'next/server';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { name, title, group, fields, dryRun, noFiles, commit, openPr, prTitle, outPrefix, registry, schemaMap } = await req.json();

    const args: string[] = [
      'ts-node',
      'agents/coding/qs-block-agent.ts',
      `--name=${name}`,
      `--title=${title}`,
      `--group=${group}`,
      `--fields=${fields}`,
    ];

    if (dryRun) args.push('--dry-run');
    if (noFiles) args.push('--no-files');
    if (commit) args.push('--commit');
    if (openPr) args.push('--open-pr');
    if (prTitle) args.push(`--pr-title=${prTitle}`);
    if (outPrefix) args.push(`--out-prefix=${outPrefix}`);
    if (registry) args.push(`--registry=${registry}`);
    if (schemaMap) args.push(`--schemaMap=${schemaMap}`);

    // Use pnpm exec to resolve local ts-node
    const child = spawn('pnpm', ['exec', ...args], { cwd: process.cwd() });

    let logs = '';
    child.stdout.on('data', (d) => { logs += d.toString(); });
    child.stderr.on('data', (d) => { logs += d.toString(); });

    const code: number | null = await new Promise((resolve) => child.on('close', resolve));
    return new Response(JSON.stringify({ code, logs }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

