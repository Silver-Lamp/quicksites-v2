/**
 * The publish route must never go back to a direct UPDATE on templates.
 *
 * trg_guard_templates_update rejects every direct update unconditionally, so the previous
 * implementation returned a 400 carrying a raw Postgres message and the admin Publish
 * button could not publish anything. That is invisible from the TypeScript — the code
 * reads perfectly, and only the database objects — so the guard here is over the source.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROUTE = join(process.cwd(), 'app/api/templates/[id]/publish/route.ts');
const src = readFileSync(ROUTE, 'utf8');

describe('publish route', () => {
  it('publishes through the sanctioned RPC', () => {
    expect(src).toContain("rpc('publish_template'");
  });

  it('never writes the publish pointer with a direct update', () => {
    // Matches `.from('templates').update(` across whitespace/newlines, which is the exact
    // statement the guard raises on.
    const directUpdate = /\.from\(\s*['"]templates['"]\s*\)[\s\S]{0,80}?\.update\(/;
    expect(directUpdate.test(src)).toBe(false);
  });

  it('passes the actor and the requested version through to the RPC', () => {
    // published_by and published_version_id are set inside the function; dropping either
    // argument loses the audit trail silently rather than failing.
    expect(src).toContain('p_actor');
    expect(src).toContain('p_version_id');
  });

  it('still surfaces a failure rather than reporting a publish that did not happen', () => {
    expect(src).toMatch(/if \(upErr\) return NextResponse\.json\(\s*\{ error: upErr\.message \}/);
  });

  it('reports the snapshot actually published', () => {
    // With no version named the RPC mints one; echoing back the request's `null` would
    // tell the caller nothing was published when something was.
    expect(src).toContain('snapshotId');
  });
});
