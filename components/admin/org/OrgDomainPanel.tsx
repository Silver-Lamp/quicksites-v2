'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Copy, Loader2, CheckCircle2, AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';
import { useVerifyDomain } from '@/hooks/useVerifyDomain';

const DOMAIN_RX = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;
const stripProto = (d: string) => d.replace(/^https?:\/\//i, '');
const stripTrailingDot = (d: string) => d.replace(/\.$/, '');
const stripWww = (d: string) => d.replace(/^www\./i, '');
const normalizeApex = (d: string) =>
  stripTrailingDot(stripWww(stripProto(String(d || '').trim().toLowerCase())));

async function postJson<T=any>(url: string, body: any): Promise<T> {
  const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body), cache:'no-store' });
  const txt = await res.text();
  let json:any; try { json = txt ? JSON.parse(txt) : {}; } catch { json = { ok:false, error:txt||`HTTP ${res.status}` }; }
  if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
  return json as T;
}
const inline = (x:any) => (x==null ? '' : typeof x==='object' ? (x.value??x.name??x.domain??JSON.stringify(x)) : String(x));
const flatten = (v:any):string[] => {
  const out:string[]=[]; const seen=new Set<string>();
  const push=(x:any)=>{ if(x==null)return; if(Array.isArray(x)){x.forEach(push);return;}
    const t=typeof x; if(t==='string'||t==='number'||t==='boolean'){const s=String(x).trim(); if(s && !seen.has(s)){seen.add(s); out.push(s);} return;}
    if(t==='object'){ if('value' in x) return push(x.value); if('values' in x) return push(x.values); const s=inline(x); if(s && !seen.has(s)){seen.add(s); out.push(s);} }
  }; push(v); return out;
};

type ConnectResponse = {
  ok: boolean;
  primary: string;             // www.apex
  redirectFrom: string;        // apex
  verified: boolean;
  verification?: Array<{ type:any; domain:any; value:any }>;
  recommended?: { ipv4?: any; cname?: any };
  autoConfigured?: { provider:'namecheap'; applied:boolean; reason?:string };
};

export default function OrgDomainPanel({
  orgId, orgSlug, initialDomain, initialWildcard=false, initialCanonical='www'
}: {
  orgId: string;
  orgSlug: string;
  initialDomain?: string | null;
  initialWildcard?: boolean;
  initialCanonical?: 'www'|'apex';
}) {
  const [domainInput, setDomainInput] = useState<string>(String(initialDomain ?? ''));
  const [canonical, setCanonical] = useState<'www'|'apex'>(initialCanonical);
  const [wildcard, setWildcard] = useState<boolean>(!!initialWildcard);
  const [autoConfigure, setAutoConfigure] = useState(true);

  const [busyConnect, setBusyConnect] = useState(false);
  const [busyVerify, setBusyVerify] = useState(false);
  const [busyRemove, setBusyRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<ConnectResponse | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const apex = normalizeApex(domainInput);
  const primary = resp?.primary || (apex ? (canonical==='www' ? `www.${apex}` : apex) : '');

  const onBlur = () => {
    const n = normalizeApex(domainInput || '');
    if (n && n !== domainInput) setDomainInput(n);
  };

  const aValues = useMemo(() => {
    const raw = (resp?.recommended?.ipv4 ?? '76.76.21.21');
    const list = flatten(raw);
    return list.length ? list : ['76.76.21.21'];
  }, [resp?.recommended?.ipv4]);

  const cnameValues = useMemo(() => {
    const raw = (resp?.recommended?.cname ?? 'cname.vercel-dns.com');
    const list = flatten(raw);
    return list.length ? list : ['cname.vercel-dns.com'];
  }, [resp?.recommended?.cname]);

  async function persistOrgDomain(next: string | null, wc: boolean, canon:'www'|'apex') {
    await postJson(`/api/admin/org/${orgId}/primary-domain`, {
      primary_domain: next, wildcard_enabled: wc, canonical_host: canon,
    });
  }

  async function connect() {
    setError(null);
    const d = normalizeApex(domainInput);
    if (!d || !DOMAIN_RX.test(d)) return setError('Enter a valid domain like example.com (no https://).');
    setBusyConnect(true);
    try {
      // attach apex+www (+ optional wildcard) and prefer www->primary unless user chose apex
      const json = await postJson<ConnectResponse>('/api/domains/connect', {
        domain: d,
        redirectToWWW: canonical === 'www',
        autoConfigure: autoConfigure ? 'detect' : false,
        wildcard, // requires connect route patch below
      });
      setResp(json);
      await persistOrgDomain(d, wildcard, canonical);
    } catch (e:any) {
      setError(e?.message || 'Connect failed.');
    } finally {
      setBusyConnect(false);
    }
  }

  async function verify() {
    if (!primary) return;
    setBusyVerify(true); setError(null);
    try {
      const v = await postJson<{ ok:boolean; verified:boolean }>('/api/domains/verify', { domain: primary });
      setResp(r => (r ? { ...r, verified: !!v?.verified } : r));
      setLastCheckedAt(Date.now());
    } catch (e:any) {
      setError(e?.message || 'Could not verify yet.');
    } finally {
      setBusyVerify(false);
    }
  }

  async function detach() {
    const d = apex; if (!d) return setError('Enter a domain first.');
    if (!confirm(`Remove ${d} and www.${d} from Vercel? DNS will not be changed.`)) return;
    setBusyRemove(true); setError(null);
    try {
      await postJson('/api/domains/remove', { domain: d });
      setResp(null);
    } catch (e:any) {
      setError(e?.message || 'Remove failed.');
    } finally {
      setBusyRemove(false);
    }
  }

  async function clearSaved() {
    await persistOrgDomain(null, false, canonical);
    setDomainInput(''); setResp(null);
  }

  // auto-verify poll once connected and not yet verified
  const verifyTarget = resp?.primary || (apex ? (canonical==='www' ? `www.${apex}` : apex) : null);
  const { status: pollStatus } = useVerifyDomain(verifyTarget, {
    enabled: !!verifyTarget && !(resp?.verified),
    intervalMs: 10_000,
    maxAttempts: 18,
    onVerified: () => setResp(r => (r ? { ...r, verified: true } : r)),
  });
  useEffect(() => { if (pollStatus === 'verifying') setLastCheckedAt(Date.now()); }, [pollStatus]);

  const copyAll = async () => {
    const lines:string[] = [];
    aValues.forEach(ip => lines.push(`A @ ${ip}`));
    cnameValues.forEach(cn => lines.push(`CNAME www ${cn}`));
    if (wildcard) lines.push(`CNAME * cname.vercel-dns.com`);
    try { await navigator.clipboard.writeText(lines.join('\n')); } catch {}
  };

  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3 mt-8">
      <div className="flex items-center justify-between">
        <Label className="text-white/80">White-label Domain (Organization)</Label>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 items-center">
        <Input value={domainInput} onChange={e=>setDomainInput(e.target.value)} onBlur={onBlur}
          placeholder="cedarsites.com" className="bg-gray-800 text-white border border-gray-700 w-64" />

        <div className="flex items-center gap-2 text-xs text-white/70">
          <span>Primary host:</span>
          <Button size="sm" variant={canonical==='www'?'default':'outline'} onClick={()=>setCanonical('www')}>www</Button>
          <Button size="sm" variant={canonical==='apex'?'default':'outline'} onClick={()=>setCanonical('apex')}>apex</Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/70">
          <Switch checked={wildcard} onCheckedChange={setWildcard} />
          <span>Attach wildcard (*.domain) for site slugs</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/70">
          <Switch checked={autoConfigure} onCheckedChange={setAutoConfigure} />
          <span>Auto-configure DNS (Namecheap)</span>
        </div>

        <Button size="sm" onClick={connect} disabled={busyConnect}>
          {busyConnect ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
        </Button>

        {resp && (
          <Button size="sm" variant="secondary" disabled={busyVerify || pollStatus==='verifying'} onClick={verify}>
            {busyVerify || pollStatus==='verifying' ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><RefreshCcw className="h-4 w-4 mr-1" /> Verify</>)}
          </Button>
        )}

        <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" disabled={busyRemove || !apex} onClick={detach}>
          {busyRemove ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />} Remove
        </Button>

        {resp && (
          <Button size="sm" variant="outline" onClick={copyAll}><Copy className="h-4 w-4 mr-1" /> Copy all</Button>
        )}

        <Button size="sm" variant="ghost" onClick={clearSaved} className="text-white/70 hover:text-white">Clear saved</Button>
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 text-amber-300 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {apex && (
        <p className="mt-2 text-xs text-white/60">
          Canonical: {canonical==='www'
            ? (<><code>www.{apex}</code> serves; <code>{apex}</code> 307-redirects.</>)
            : (<><code>{apex}</code> serves; <code>www.{apex}</code> 307-redirects.</>)
          }
          {wildcard && <> · Wildcard <code>*.{apex}</code> will route slugs like <code>site.{apex}</code>.</>}
        </p>
      )}

      {resp && (
        <div className="mt-3 rounded border border-white/10 bg-neutral-950/40 p-3 text-sm text-white/90">
          <div className="flex flex-wrap items-center gap-3">
            {resp.verified ? (
              <span className="inline-flex items-center text-emerald-400">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Verified for <code className="px-1 py-0.5 bg-neutral-900 rounded">https://{inline(resp.primary)}</code>
              </span>
            ) : (
              <span className="inline-flex items-center text-yellow-300">
                <AlertTriangle className="h-4 w-4 mr-1" /> Pending verification for <code className="px-1 py-0.5 bg-neutral-900 rounded">https://{inline(resp.primary)}</code>
              </span>
            )}
          </div>

          {resp.autoConfigured && (
            <p className="mt-1 text-xs">Auto-configure: <span className={resp.autoConfigured.applied ? 'text-emerald-400' : 'text-white/70'}>
              {resp.autoConfigured.applied ? 'applied via Namecheap' : `skipped (${resp.autoConfigured.reason || 'not supported'})`}
            </span></p>
          )}

          <div className="mt-3">
            <Label className="text-xs text-white/70">Add these DNS records</Label>

            <div className="mt-2 overflow-hidden rounded border border-white/10">
              <div className="grid grid-cols-[auto_auto_auto_1fr_auto] gap-2 p-2 border-b border-white/10">
                <span className="text-xs px-1 py-0.5 rounded bg-neutral-900">Type</span><code className="px-1">A</code>
                <span className="text-xs px-1 py-0.5 rounded bg-neutral-900">Name</span><code className="px-1">@</code>
                <span className="text-xs text-white/60">Add each value below</span>
              </div>
              {aValues.map((ip,i)=>(
                <div key={i} className="grid grid-cols-[auto_auto_auto_1fr_auto] gap-2 p-2 border-t border-white/5">
                  <span className="text-xs text-white/60">Value</span><span className="text-xs text-white/60 col-span-2"></span>
                  <code className="px-1">{ip}</code>
                  <Button size="sm" variant="outline" onClick={()=>navigator.clipboard.writeText(ip)}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
                </div>
              ))}
            </div>

            <div className="mt-3 overflow-hidden rounded border border-white/10">
              <div className="grid grid-cols-[auto_auto_auto_1fr_auto] gap-2 p-2 border-b border-white/10">
                <span className="text-xs px-1 py-0.5 rounded bg-neutral-900">Type</span><code className="px-1">CNAME</code>
                <span className="text-xs px-1 py-0.5 rounded bg-neutral-900">Name</span><code className="px-1">www</code>
                <span className="text-xs text-white/60">Add one of the values below</span>
              </div>
              {cnameValues.map((cn,i)=>(
                <div key={i} className="grid grid-cols-[auto_auto_auto_1fr_auto] gap-2 p-2 border-t border-white/5">
                  <span className="text-xs text-white/60">Value</span><span className="text-xs text-white/60 col-span-2"></span>
                  <code className="px-1">{cn}</code>
                  <Button size="sm" variant="outline" onClick={()=>navigator.clipboard.writeText(cn)}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
                </div>
              ))}
            </div>

            {wildcard && (
              <div className="mt-3 overflow-hidden rounded border border-white/10">
                <div className="grid grid-cols-[auto_auto_auto_1fr_auto] gap-2 p-2 border-b border-white/10">
                  <span className="text-xs px-1 py-0.5 rounded bg-neutral-900">Type</span><code className="px-1">CNAME</code>
                  <span className="text-xs px-1 py-0.5 rounded bg-neutral-900">Name</span><code className="px-1">*</code>
                  <span className="text-xs text-white/60">Add this for subdomains</span>
                </div>
                <div className="grid grid-cols-[auto_auto_auto_1fr_auto] gap-2 p-2">
                  <span className="text-xs text-white/60">Value</span><span className="text-xs text-white/60 col-span-2"></span>
                  <code className="px-1">cname.vercel-dns.com</code>
                  <Button size="sm" variant="outline" onClick={()=>navigator.clipboard.writeText('cname.vercel-dns.com')}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
                </div>
              </div>
            )}

            {!resp.verified && (
              <p className="mt-2 text-xs text-white/60">
                After adding records, click <em>Verify</em>. We also auto-check every ~10s.
                {lastCheckedAt ? ` Last check ${new Date(lastCheckedAt).toLocaleTimeString()}.` : null}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
