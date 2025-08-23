'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, Phone, Sparkles, Check, Loader } from 'lucide-react';

// shadcn/ui — adjust paths if needed
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

const EMAIL_SALES = 'sandon@quicksites.ai';
const EMAIL_SUPPORT = 'sandon@quicksites.ai';
const API_PATH = '/api/contact'; // optional server route (we can scaffold if not present)

export default function ContactPage() {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [sites, setSites] = React.useState<number | ''>('');
  const [message, setMessage] = React.useState('');
  const [migrating, setMigrating] = React.useState(false);
  const [wantFounder, setWantFounder] = React.useState(true);
  const [includeAI, setIncludeAI] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [hp, setHp] = React.useState(''); // honeypot

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (hp.trim().length > 0) return; // bot
    if (!name || !email || !message) {
      setError('Please fill your name, email, and a short message.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company, sites: Number(sites) || 0, message, migrating, wantFounder, includeAI }),
      });

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setSuccess('Thanks! We received your message and will reply within 1 business day.');
      setName('');
      setEmail('');
      setCompany('');
      setSites('');
      setMessage('');
      setMigrating(false);
      setIncludeAI(false);
      setWantFounder(true);
    } catch (err) {
      console.error(err);
      setError('Something went wrong sending your message. You can also email us directly.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-6xl px-6 pt-14 pb-8"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">Contact</Badge>
            <Badge variant="secondary" className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5"/>Founder Window</Badge>
          </div>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">Talk to a human</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Have questions about pricing, migrations, or the AI Assist Pack? Send a message — we usually reply within one business day.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/pricing" className="inline-flex">
              <Button size="lg" variant="ghost">See Pricing</Button>
            </Link>
            <a href={`mailto:${EMAIL_SALES}`} className="inline-flex">
              <Button size="lg">
                Email Sales
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </motion.div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      </section>

      {/* Form + Info */}
      <section className="mx-auto max-w-6xl px-6 pb-14 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Send us a message</CardTitle>
            <CardDescription>We’ll follow up at the email you provide. Fields marked * are required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              {/* Honeypot */}
              <div className="hidden">
                <Label htmlFor="website">Website</Label>
                <Input id="website" name="website" value={hp} onChange={(e) => setHp(e.target.value)} autoComplete="off" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@agency.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your Agency" />
                </div>
                <div>
                  <Label htmlFor="sites">How many sites?</Label>
                  <Input
                    id="sites"
                    type="number"
                    min={0}
                    value={sites}
                    onChange={(e) => setSites(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    placeholder="e.g., 25"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="message">Message *</Label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you’re building, your timeline, and anything else we should know."
                  required
                  className="mt-2 w-full rounded-md border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  rows={6}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* <ToggleLine
                  id="migrating"
                  label={<span className="flex items-center gap-2">Migrating from Site Panda?<Badge variant="secondary">We’ll help</Badge></span>}
                  checked={migrating}
                  onChange={setMigrating}
                /> */}
                <ToggleLine
                  id="founder"
                  label="Request Founder pricing (grandfathered)"
                  checked={wantFounder}
                  onChange={setWantFounder}
                />
                <ToggleLine
                  id="ai"
                  label={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4"/>Interested in AI Assist Pack</span>}
                  checked={includeAI}
                  onChange={setIncludeAI}
                />
              </div>

              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
                  {error} <a className="underline ml-1" href={`mailto:${EMAIL_SALES}`}>Email us</a>.
                </div>
              )}
              {success && (
                <div className="rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm">
                  {success}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2"><Loader className="h-4 w-4 animate-spin"/>Sending…</span>
                  ) : (
                    <span className="inline-flex items-center gap-2">Send message<ArrowRight className="h-4 w-4"/></span>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">We reply within 1 business day.</p>
              </div>
            </form>
          </CardContent>
        </Card>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
              <CardDescription>Pick the channel that suits you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <a href={`mailto:${EMAIL_SALES}`} className="group inline-flex items-center gap-2">
                <Mail className="h-4 w-4"/>
                <span>Sales:</span>
                <span className="font-medium group-hover:underline">{EMAIL_SALES}</span>
              </a>
              <a href={`mailto:${EMAIL_SUPPORT}`} className="group inline-flex items-center gap-2">
                <Mail className="h-4 w-4"/>
                <span>Support:</span>
                <span className="font-medium group-hover:underline">{EMAIL_SUPPORT}</span>
              </a>
              <div className="text-xs text-muted-foreground">Prefer a quick call? Include your phone and availability and we’ll schedule.</div>
            </CardContent>
            <CardFooter>
              <Link href="/pricing" className="inline-flex"><Button variant="outline">View pricing</Button></Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FAQ</CardTitle>
              <CardDescription>Short answers to common questions.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <FaqItem q="Can you migrate my sites?" a="Yes. We can provide a guided migration from other platforms. We’ll also honor Founder pricing for 12 months." />
              <FaqItem q="Do I need the AI add‑on?" a="No. The base platform includes everything to build and host. The AI pack is optional and can be added per user later." />
              <FaqItem q="Is there an annual option?" a="We’re starting monthly-only during beta; annual plans will arrive as we exit beta." />
            </CardContent>
          </Card>
        </aside>
      </section>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <Card className="bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="py-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl md:text-2xl font-semibold">Ready to switch?</h3>
              <p className="text-muted-foreground">Tell us what you’re building and we’ll help you launch — fast.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/pricing" className="inline-flex"><Button size="lg" variant="outline">See pricing</Button></Link>
              <a href={`mailto:${EMAIL_SALES}`} className="inline-flex"><Button size="lg">Email sales<ArrowRight className="ml-2 h-4 w-4"/></Button></a>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ToggleLine({ id, label, checked, onChange }: { id: string; label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer select-none">
      <span className="text-sm">{label}</span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <div className="font-medium">{q}</div>
      <div className="text-muted-foreground">{a}</div>
    </div>
  );
}
