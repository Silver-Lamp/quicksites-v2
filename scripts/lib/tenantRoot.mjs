// scripts/lib/tenantRoot.mjs — the scripts' copy of lib/sites/tenantRoot.ts (an .mjs cannot
// import the TS module). Same rule: `NEXT_PUBLIC_TENANT_ROOT` else the brand root. A script
// that spells `quicksites.ai` itself prints the old host after the move; read it from here.
export const BRAND_ROOT = 'quicksites.ai';

export function tenantRoot(env = process.env) {
  const v = String(env.NEXT_PUBLIC_TENANT_ROOT ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
  return v && v !== BRAND_ROOT && v.includes('.') ? v : BRAND_ROOT;
}

export function tenantSiteHost(slug, env = process.env) {
  const s = String(slug ?? '').trim().toLowerCase();
  return s ? `${s}.${tenantRoot(env)}` : '';
}

export function tenantSiteUrl(slug, env = process.env) {
  const h = tenantSiteHost(slug, env);
  return h ? `https://${h}` : '';
}
