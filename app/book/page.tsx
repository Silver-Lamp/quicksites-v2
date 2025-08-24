'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Calendar, ArrowRight, Sparkles } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || '';

export default function BookPage() {
  // fallback form state
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const ok = name.trim() && /\S+@\S+\.\S+/.test(email);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: swap to your existing contact API/email action
    console.log('Demo request:', { name, email, msg });
    setSent(true);
  }

  return (
    <div className="relative">
      {/* hero */}
      <section className="relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-6xl px-6 pt-14 pb-6"
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge variant="outline">Demo</Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              Guided tour
            </Badge>
          </div>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
            Book a live walkthrough
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            20–30 minutes to see QuickSites in action and talk through your workflow.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/features" className="inline-flex">
              <Button size="lg" variant="ghost">
                See features
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      </section>

      {/* body */}
      <section className="mx-auto max-w-6xl px-6 pb-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calendly embed (if provided) */}
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>Pick a time</CardTitle>
            </div>
            <CardDescription>Connect on Zoom and get answers fast.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {CALENDLY_URL ? (
              <div className="aspect-video rounded-lg overflow-hidden border">
                <iframe
                  title="Book a demo"
                  className="w-full h-full"
                  src={CALENDLY_URL}
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                Set <code>NEXT_PUBLIC_CALENDLY_URL</code> to show your scheduler here.
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Link href="/contact" className="inline-flex">
              <Button variant="outline">Contact sales</Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Fallback request form */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Request a custom demo</CardTitle>
            <CardDescription>Tell us your use case — we’ll tailor the walkthrough.</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4 text-sm">
                Thanks! We’ll reply shortly.
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="msg">What would you like to see?</Label>
                  <Textarea id="msg" rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} />
                </div>
                <Button type="submit" disabled={!ok}>Send request</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
