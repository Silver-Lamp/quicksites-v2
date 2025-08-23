import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Mail, Check, Archive, Undo, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

// Types
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

export type ContactNote = {
  id: string;
  created_at: string;
  message_id: string;
  author_id: string;
  body: string;
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

// Server actions
export async function addNote(formData: FormData) {
  'use server';
  const message_id = String(formData.get('message_id') || '');
  const body = (formData.get('body')?.toString() || '').trim();
  if (!message_id || !body) return;
  const supabase = await getServerSupabase();
  const { error } = await supabase.from('contact_message_notes').insert({ message_id, body });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/inbox/${message_id}`);
}

export async function updateStatus(formData: FormData) {
  'use server';
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || 'new') as ContactMessage['status'];
  if (!id) return;
  const supabase = await getServerSupabase();
  const payload: Partial<ContactMessage> = { status };
  if (status === 'contacted') payload.responded_at = new Date().toISOString();
  const { error } = await supabase.from('contact_messages').update(payload).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/inbox/${id}`);
  revalidatePath('/admin/inbox');
}

export default async function InboxDetailPage({ params }: { params: { id: string } }) {
  const supabase = await getServerSupabase();
  const id = params.id;

  const { data: msg } = await supabase.from('contact_messages').select('*').eq('id', id).single();
  if (!msg) return notFound();

  const { data: notes } = await supabase
    .from('contact_message_notes')
    .select('*')
    .eq('message_id', id)
    .order('created_at', { ascending: false });

  const created = format(new Date(msg.created_at), 'yyyy-MM-dd HH:mm');

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/inbox"><Button variant="outline" className="inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4"/>Back</Button></Link>
          <h1 className="text-2xl font-semibold">{msg.name}</h1>
          {statusBadge(msg.status)}
        </div>
        <div className="flex items-center gap-2">
          <a href={mailtoTemplate(msg, 'intro')}><Button variant="secondary" className="inline-flex items-center gap-2"><Mail className="h-4 w-4"/>Intro</Button></a>
          <a href={mailtoTemplate(msg, 'pricing')}><Button variant="outline" className="inline-flex items-center gap-2"><Mail className="h-4 w-4"/>Pricing</Button></a>
          <a href={mailtoTemplate(msg, 'migration')}><Button variant="outline" className="inline-flex items-center gap-2"><Mail className="h-4 w-4"/>Migration</Button></a>
          <a href={mailtoTemplate(msg, 'followup')}><Button variant="outline" className="inline-flex items-center gap-2"><Mail className="h-4 w-4"/>Follow‑up</Button></a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Message</CardTitle>
            <CardDescription>{created} • {msg.email}{msg.company ? ` • ${msg.company}` : ''}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-3 whitespace-pre-wrap text-sm">{msg.message}</div>
            <div className="flex flex-wrap gap-2 text-xs">
              {msg.migrating && <Badge variant="secondary">Migrating</Badge>}
              {msg.want_founder && <Badge variant="outline">Founder</Badge>}
              {msg.include_ai && <Badge variant="outline"><Sparkles className="h-3 w-3 mr-1"/>AI</Badge>}
              <Badge variant="outline">Sites: {msg.sites}</Badge>
            </div>
          </CardContent>
          <CardFooter>
            <form action={updateStatus} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={msg.id} />
              {msg.status !== 'contacted' && (
                <Button type="submit" name="status" value="contacted" variant="secondary" className="inline-flex items-center gap-2"><Check className="h-4 w-4"/>Mark Contacted</Button>
              )}
              {msg.status !== 'archived' ? (
                <Button type="submit" name="status" value="archived" variant="outline" className="inline-flex items-center gap-2"><Archive className="h-4 w-4"/>Archive</Button>
              ) : (
                <Button type="submit" name="status" value="new" variant="outline" className="inline-flex items-center gap-2"><Undo className="h-4 w-4"/>Restore</Button>
              )}
            </form>
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
              <CardDescription>Metadata</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div><span className="text-muted-foreground">Email:</span> <a className="text-primary hover:underline" href={`mailto:${msg.email}`}>{msg.email}</a></div>
              <div><span className="text-muted-foreground">Created:</span> {created}</div>
              <div><span className="text-muted-foreground">Company:</span> {msg.company || '—'}</div>
              <div><span className="text-muted-foreground">IP:</span> {msg.ip || '—'}</div>
              <div className="truncate"><span className="text-muted-foreground">UA:</span> {msg.user_agent || '—'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thread</CardTitle>
              <CardDescription>Internal notes (admin‑only)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={addNote} className="space-y-2">
                <input type="hidden" name="message_id" value={msg.id} />
                <Label htmlFor="note">Add note</Label>
                <Textarea id="note" name="body" placeholder="Next steps, call outcome, etc." rows={3} />
                <div>
                  <Button type="submit">Add note</Button>
                </div>
              </form>
              <div className="space-y-3">
                {notes?.length ? (
                  notes.map((n) => (
                    <div key={n.id} className="rounded-md border p-2">
                      <div className="mb-1 text-xs text-muted-foreground">{format(new Date(n.created_at), 'yyyy-MM-dd HH:mm')}</div>
                      <div className="text-sm whitespace-pre-wrap">{n.body}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No notes yet.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function mailtoTemplate(msg: ContactMessage, kind: 'intro' | 'pricing' | 'migration' | 'followup') {
  const subjectMap = {
    intro: `QuickSites — thanks for reaching out`,
    pricing: `QuickSites pricing & next steps`,
    migration: `We can migrate your sites to QuickSites`,
    followup: `Quick follow‑up from QuickSites`,
  } as const;

  const bodyMap = {
    intro: `Hi ${msg.name || ''},\n\nThanks for reaching out about QuickSites. I can help you get set up and talk through the best way to launch your first sites.\n\nAre you currently using another platform? If so, we can help migrate.\n\n— QuickSites Team`,
    pricing: `Hi ${msg.name || ''},\n\nHere’s our current Founder pricing (grandfathered 12 months):\n• Platform: $15/user/mo\n• Per‑site: $5/site/mo (50+ → $4.50, 200+ → $4.00)\n\nOptional AI Assist Pack: +$10/user/mo for content briefs, schema/FAQ suggestions, and drafts.\n\nIf you share roughly how many sites you’re planning (${msg.sites || 'e.g., 25'}) I can run the math for you.\n\n— QuickSites Team`,
    migration: `Hi ${msg.name || ''},\n\nWe can help migrate your sites${msg.migrating ? ' from your current platform' : ''}. We’ll also honor Founder pricing for 12 months.\n\nIf you can share a list or a sample site, we’ll outline the steps and timeline.\n\n— QuickSites Team`,
    followup: `Hi ${msg.name || ''},\n\nJust checking in to see if you had a chance to review the info I sent. Happy to answer questions or jump on a quick call.\n\n— QuickSites Team`,
  } as const;

  const mailto = new URL(`mailto:${encodeURIComponent(msg.email)}`);
  mailto.searchParams.set('subject', subjectMap[kind]);
  mailto.searchParams.set('body', bodyMap[kind]);
  return mailto.toString();
}
