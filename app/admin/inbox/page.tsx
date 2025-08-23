import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getServerSupabase } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRight, Check, Mail, Search, Archive, Undo, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

// Types matching contact_messages
export type ContactMessage = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  company: string | null;
  sites: number;
  message: string;
  migrating: boolean;
  want_founder: boolean;
  include_ai: boolean;
  ip: string | null;
  user_agent: string | null;
  status?: 'new' | 'contacted' | 'archived';
  responded_at?: string | null;
  admin_notes?: string | null;
};

function statusBadge(s?: string) {
  const map: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
    new: { variant: 'default', label: 'New' },
    contacted: { variant: 'secondary', label: 'Contacted' },
    archived: { variant: 'outline', label: 'Archived' },
  };
  const x = s && map[s] ? map[s] : map['new'];
  return <Badge variant={x.variant}>{x.label}</Badge>;
}

// ------- Server actions -------
export async function updateMessage(formData: FormData) {
  'use server';
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || 'new') as ContactMessage['status'];
  const admin_notes = (formData.get('admin_notes')?.toString() || '').trim() || null;

  if (!id) return;

  const supabase = await getServerSupabase();
  const payload: Partial<ContactMessage> = { status, admin_notes };
  if (status === 'contacted') payload.responded_at = new Date().toISOString();

  const { error } = await supabase.from('contact_messages').update(payload).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/inbox');
}

export async function bulkUpdateMessages(formData: FormData) {
  'use server';
  const supabase = await getServerSupabase();

  const bulk_status = String(formData.get('bulk_status') || '');
  if (!['new', 'contacted', 'archived'].includes(bulk_status)) return;

  const scope = String(formData.get('scope') || 'selected');
  const q = (formData.get('q')?.toString() || '').trim();
  const status = (formData.get('status')?.toString() || 'new');
  const page = Math.max(1, Number(formData.get('page') || 1));
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let targetIds = (formData.getAll('ids') as string[]).filter(Boolean);

  if (scope === 'page') {
    // Re-run the same query slice to collect all ids on the current page
    let qy = supabase
      .from('contact_messages')
      .select('id')
      .order('created_at', { ascending: false })
      .range(from, to);
    if (status && status !== 'all') qy = qy.eq('status', status);
    if (q) qy = qy.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%,message.ilike.%${q}%`);
    const { data } = await qy;
    targetIds = (data || []).map((r: any) => r.id);
  }

  if (!targetIds.length) return;

  const payload: Partial<ContactMessage> = { status: bulk_status as any };
  if (bulk_status === 'contacted') payload.responded_at = new Date().toISOString();

  const { error } = await supabase.from('contact_messages').update(payload).in('id', targetIds);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/inbox');
}

// ------- Page -------
export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: 'all' | 'new' | 'contacted' | 'archived'; page?: string };
}) {
  const supabase = await getServerSupabase();

  const q = (searchParams.q || '').trim();
  const status = (searchParams.status as ContactMessage['status'] | 'all') || 'new';
  const page = Math.max(1, Number(searchParams.page || 1));
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('contact_messages')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);
  if (q) query = query.or(
    `name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%,message.ilike.%${q}%`
  );

  const { data: rows, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <p className="text-sm text-muted-foreground">Leads from the /contact form. Filter by status, search by name, email, company, or message.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pricing"><Button variant="outline">Pricing</Button></Link>
          <Link href="/contact"><Button>New message</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Refine your view.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-6 gap-3" method="get">
            <div className="md:col-span-4">
              <Label htmlFor="q">Search</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input id="q" name="q" placeholder="name, email, company, or message" defaultValue={q} />
                <Button type="submit" variant="secondary" className="inline-flex items-center gap-2"><Search className="h-4 w-4"/>Search</Button>
              </div>
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
            <div className="self-end">
              <Button type="submit" className="w-full">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Messages</CardTitle>
          <CardDescription>{count ?? 0} total{status !== 'all' ? ` • ${status}` : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={bulkUpdateMessages}>
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="page" value={page} />

            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Label className="text-xs">Apply to</Label>
                <label className="inline-flex items-center gap-1 text-xs">
                  <input type="radio" name="scope" value="selected" defaultChecked /> Selected
                </label>
                <label className="inline-flex items-center gap-1 text-xs">
                  <input type="radio" name="scope" value="page" /> This page
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" name="bulk_status" value="contacted" variant="secondary" className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4"/> Mark Contacted
                </Button>
                <Button type="submit" name="bulk_status" value="archived" variant="outline" className="inline-flex items-center gap-2">
                  <Archive className="h-4 w-4"/> Archive
                </Button>
                <Button type="submit" name="bulk_status" value="new" variant="outline" className="inline-flex items-center gap-2">
                  <Undo className="h-4 w-4"/> Restore to New
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Select</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Name / Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Sites</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows?.map((m: ContactMessage) => (
                  <MessageRow key={m.id} m={m} />
                ))}
                {!rows?.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">No messages found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {count && count > pageSize ? (
              <div className="mt-4 flex items-center justify-between">
                <Link href={{ pathname: '/admin/inbox', query: { q, status, page: Math.max(1, page - 1) } }}>
                  <Button variant="outline" disabled={page <= 1} className="inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4"/>Prev</Button>
                </Link>
                <div className="text-sm text-muted-foreground">{from + 1}–{Math.min(to + 1, count)} of {count}</div>
                <Link href={{ pathname: '/admin/inbox', query: { q, status, page: page + 1 } }}>
                  <Button variant="outline" disabled={to + 1 >= count} className="inline-flex items-center gap-2">Next<ArrowRight className="h-4 w-4"/></Button>
                </Link>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Flags({ m }: { m: ContactMessage }) {
  return (
    <div className="flex flex-wrap gap-1">
      {m.migrating && <Badge variant="secondary">Migrating</Badge>}
      {m.want_founder && <Badge variant="outline">Founder</Badge>}
      {m.include_ai && <Badge variant="outline">AI</Badge>}
    </div>
  );
}

function MessageRow({ m }: { m: ContactMessage }) {
  const created = format(new Date(m.created_at), 'yyyy-MM-dd HH:mm');
  return (
    <TableRow className="align-top">
      <TableCell>
        <input type="checkbox" name="ids" value={m.id} aria-label={`Select ${m.name}`} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{created}</TableCell>
      <TableCell>
        <div className="font-medium flex items-center gap-2">
          <Link href={`/admin/inbox/${m.id}`} className="hover:underline inline-flex items-center gap-1">
            {m.name}
            <ExternalLink className="h-3.5 w-3.5"/>
          </Link>
        </div>
        <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <Mail className="h-3.5 w-3.5"/> {m.email}
        </a>
      </TableCell>
      <TableCell className="max-w-[18rem] truncate">{m.company || '—'}</TableCell>
      <TableCell className="text-right">{m.sites}</TableCell>
      <TableCell>{statusBadge(m.status)}</TableCell>
      <TableCell><Flags m={m} /></TableCell>
      <TableCell className="w-[26rem]">
        <MessageActions m={m} />
      </TableCell>
    </TableRow>
  );
}

function MessageActions({ m }: { m: ContactMessage }) {
  const noteDefault = m.admin_notes || '';
  return (
    <div className="space-y-2">
      <div className="rounded-md border p-2 text-sm max-h-28 overflow-auto whitespace-pre-wrap">{m.message}</div>
      <form action={updateMessage} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={m.id} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="md:col-span-2">
            <Label htmlFor={`notes-${m.id}`}>Admin notes</Label>
            <Textarea id={`notes-${m.id}`} name="admin_notes" defaultValue={noteDefault} rows={2} placeholder="Follow-up details, next steps, etc." />
          </div>
          <div className="flex md:flex-col gap-2 items-stretch justify-end pt-5 md:pt-7">
            {m.status !== 'contacted' && (
              <Button type="submit" name="status" value="contacted" variant="secondary" className="inline-flex items-center gap-2">
                <Check className="h-4 w-4"/> Contacted
              </Button>
            )}
            {m.status !== 'archived' ? (
              <Button type="submit" name="status" value="archived" variant="outline" className="inline-flex items-center gap-2">
                <Archive className="h-4 w-4"/> Archive
              </Button>
            ) : (
              <Button type="submit" name="status" value="new" variant="outline" className="inline-flex items-center gap-2">
                <Undo className="h-4 w-4"/> Restore
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
