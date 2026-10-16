// app/admin/inbox/site-forms/page.tsx
//
// Leads from the contact forms on TENANT sites (`form_submissions`), beside the Platform Inbox
// (`contact_messages`, QuickSites' own /contact form). Owner, 2026-10-16: the inbox as the system
// of record for site leads — a lead must not depend on an email arriving anywhere.
//
// ⚠️ This table had NO admin surface before today, and its writes had been failing since
// 2026-06-27 (CLAUDE.md §8). Rows here are the truth about who asked; the email the form also
// sends is a courtesy. Service role (admin page; the layout gates on an admin session).
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { format } from 'date-fns';
import { Archive, ArrowLeft, ArrowRight, Check, ExternalLink, Mail, Phone, Search, Undo } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SiteLead = {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  service: string | null;
  site_slug: string | null;
  email_status: string | null;
  email_error: string | null;
  status?: 'new' | 'contacted' | 'archived';
  responded_at?: string | null;
  admin_notes?: string | null;
};

const STATUSES = ['new', 'contacted', 'archived'] as const;

function statusBadge(s?: string) {
  const map: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
    new: { variant: 'default', label: 'New' },
    contacted: { variant: 'secondary', label: 'Contacted' },
    archived: { variant: 'outline', label: 'Archived' },
  };
  const x = s && map[s] ? map[s] : map.new;
  return <Badge variant={x.variant}>{x.label}</Badge>;
}

/** The courtesy email's fate, as the form recorded it — "sent" is the only word that means it left. */
function emailBadge(status: string | null, error: string | null) {
  if (status === 'sent') return <Badge variant="secondary">emailed</Badge>;
  if (status === 'error') return <Badge variant="outline" title={error ?? ''}>email failed</Badge>;
  return <Badge variant="outline">no email</Badge>;
}

export async function bulkUpdateSiteLeads(formData: FormData) {
  'use server';
  // `types/supabase.ts` predates the status columns (CLAUDE.md §8: regenerate locally); untyped here.
  const supabase = (await getServerSupabase({ serviceRole: true })) as any;
  const bulk = String(formData.get('bulk_status') || '');
  if (!STATUSES.includes(bulk as (typeof STATUSES)[number])) return;
  const ids = formData.getAll('ids').map(String).filter(Boolean);
  if (!ids.length) return;
  const payload: Partial<SiteLead> = { status: bulk as SiteLead['status'] };
  if (bulk === 'contacted') payload.responded_at = new Date().toISOString();
  await supabase.from('form_submissions').update(payload).in('id', ids);
  revalidatePath('/admin/inbox/site-forms');
}

export default async function SiteFormsInboxPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: 'all' | 'new' | 'contacted' | 'archived'; site?: string; page?: string };
}) {
  const supabase = (await getServerSupabase({ serviceRole: true })) as any;
  const q = (searchParams.q || '').trim();
  const site = (searchParams.site || '').trim();
  const status = (searchParams.status as SiteLead['status'] | 'all') || 'new';
  const page = Math.max(1, Number(searchParams.page || 1));
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('form_submissions').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (status && status !== 'all') query = query.eq('status', status);
  if (site) query = query.eq('site_slug', site);
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,service.ilike.%${q}%,site_slug.ilike.%${q}%`);
  const { data: rows, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);
  const leads = (rows ?? []) as SiteLead[];
  const query_ = { q, status, site };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Site forms</h1>
          <p className="text-sm text-muted-foreground">
            Leads from the contact forms on customer sites. The row is the record; the email each form also sends is a courtesy.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/inbox?status=all"><Button variant="outline">Platform Inbox</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>By status, site, or a word in the lead.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-6 gap-3" method="get">
            <div className="md:col-span-3">
              <Label htmlFor="q">Search</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input id="q" name="q" placeholder="name, email, phone, service, or site" defaultValue={q} />
                <Button type="submit" variant="secondary" className="inline-flex items-center gap-2"><Search className="h-4 w-4" />Search</Button>
              </div>
            </div>
            <div>
              <Label htmlFor="site">Site slug</Label>
              <Input id="site" name="site" placeholder="bhard" defaultValue={site} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" defaultValue={status} className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm">
                <option value="all">All</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="self-end"><Button type="submit" className="w-full">Apply</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Leads</CardTitle>
          <CardDescription>{count ?? 0} total{status !== 'all' ? ` • ${status}` : ''}{site ? ` • ${site}` : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="bulk-form" action={bulkUpdateSiteLeads}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button type="submit" name="bulk_status" value="contacted" variant="secondary" className="inline-flex items-center gap-2"><Check className="h-4 w-4" /> Mark Contacted</Button>
              <Button type="submit" name="bulk_status" value="archived" variant="outline" className="inline-flex items-center gap-2"><Archive className="h-4 w-4" /> Archive</Button>
              <Button type="submit" name="bulk_status" value="new" variant="outline" className="inline-flex items-center gap-2"><Undo className="h-4 w-4" /> Restore to New</Button>
              <span className="text-xs text-muted-foreground">Applies to the selected rows.</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Select</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Interested in</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((m) => (
                  <TableRow key={m.id} className="align-top">
                    <TableCell><input type="checkbox" name="ids" value={m.id} aria-label={`Select ${m.name ?? m.id}`} /></TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(m.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                    <TableCell>
                      {m.site_slug ? (
                        <a href={`/sites/${m.site_slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm hover:underline">
                          {m.site_slug} <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{m.name || '—'}</div>
                      {m.email ? <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><Mail className="h-3.5 w-3.5" /> {m.email}</a> : null}
                      {m.phone ? <div><a href={`tel:${m.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><Phone className="h-3.5 w-3.5" /> {m.phone}</a></div> : null}
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate">{m.service || '—'}</TableCell>
                    <TableCell>{emailBadge(m.email_status, m.email_error)}</TableCell>
                    <TableCell>{statusBadge(m.status)}</TableCell>
                  </TableRow>
                ))}
                {!leads.length && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No leads match.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            {count && count > pageSize ? (
              <div className="mt-4 flex items-center justify-between">
                <Link href={{ pathname: '/admin/inbox/site-forms', query: { ...query_, page: Math.max(1, page - 1) } }}>
                  <Button variant="outline" disabled={page <= 1} className="inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Prev</Button>
                </Link>
                <div className="text-sm text-muted-foreground">{from + 1}–{Math.min(to + 1, count)} of {count}</div>
                <Link href={{ pathname: '/admin/inbox/site-forms', query: { ...query_, page: page + 1 } }}>
                  <Button variant="outline" disabled={to + 1 >= count} className="inline-flex items-center gap-2">Next<ArrowRight className="h-4 w-4" /></Button>
                </Link>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
