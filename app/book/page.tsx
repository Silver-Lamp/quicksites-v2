'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Calendar, ArrowRight, Sparkles } from 'lucide-react';

import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SiteHeader from '@/components/site/site-header';

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || '';

export default function BookPage() {
  return (
    <>
    <SiteHeader sticky={true} />
    <div className="relative min-h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">

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
            <Link href="/pricing" className="inline-flex">
              <Button size="lg" variant="ghost">
                See pricing
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
        <Card
          className={[
            'h-full border-zinc-800/50',
            'ring-1 ring-purple-500/25',
            'bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent',
            'shadow-[0_10px_40px_-12px_rgba(168,85,247,0.45)]',
          ].join(' ')}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-400" />
              <CardTitle>Pick a time</CardTitle>
            </div>
            <CardDescription>Connect on Zoom and get answers fast.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {CALENDLY_URL ? (
              <div className="aspect-video rounded-lg overflow-hidden border border-zinc-800/50">
                <iframe
                  title="Book a demo"
                  className="w-full h-full"
                  src={CALENDLY_URL}
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-800/50 bg-muted/40 p-4 text-sm text-muted-foreground">
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

        {/* Route to Contact instead of email form */}
        <Card className="h-full border-zinc-800/50">
          <CardHeader>
            <CardTitle>No time on the calendar?</CardTitle>
            <CardDescription>
              Tell us your use case and preferred times — we’ll reply within 1 business day.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Use our contact form to share details about your sites, migration plans, or the AI Assist Pack.
              We’ll follow up with a tailored demo or async walkthrough.
            </p>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Link href="/contact" className="inline-flex">
              <Button size="lg" variant="secondary">
                Go to contact form
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/features" className="inline-flex">
              <Button size="lg" variant="outline">Explore features</Button>
            </Link>
          </CardFooter>
        </Card>
      </section>
    </div>
    </>
  );
}
