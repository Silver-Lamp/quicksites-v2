// components/admin/tools/AdminToolsPage.tsx
'use client';

import * as React from 'react';
import { CurrentUserContext } from '@/components/admin/context/current-user-provider';

import { StickyOutput } from '@/components/admin/tools/StickyOutput';
import { useRunner } from '@/components/admin/tools/useRunner';
import { LeftNav, type ToolGroup } from '@/components/admin/tools/LeftNav';

import {
  CreateUserCard, PromoteChefCard, EnableComplianceCard, CreateMealCard,
} from '@/components/admin/tools/cards/basic';
import {
  CreateDemoReviewsCard, RestockMealCard, SendRestockEmailsCard,
} from '@/components/admin/tools/cards/meals';
import {
  MarkComplianceDocCard, SeedComplianceSetCard, DeactivateMealCard,
  CreateAiEndorsementCard, ApproveAllRequirementsCard,
} from '@/components/admin/tools/cards/compliance';
import {
  CloneMealCard, BulkGenerateMealsCard, NukeDemoDataCard,
  GenerateQrInvitesCard, StickerSheetCard,
} from '@/components/admin/tools/cards/advanced';

const GROUPS: ToolGroup[] = [
  { title: 'Users', items: [
    { id: 'tool-1', label: '1) Create new user' },
    { id: 'tool-2', label: '2) Promote to chef' },
  ]},
  { title: 'Compliance', items: [
    { id: 'tool-3', label: '3) Enable compliance' },
    { id: 'tool-8', label: '8) Mark compliance doc' },
    { id: 'tool-9', label: '9) Seed compliance set' },
    { id: 'tool-11', label: '11) Create AI Endorsement' },
    { id: 'tool-12', label: '12) Approve ALL requirements' },
  ]},
  { title: 'Meals', items: [
    { id: 'tool-4', label: '4) Make a meal' },
    { id: 'tool-5', label: '5) Create demo reviews' },
    { id: 'tool-6', label: '6) Restock & waitlist' },
    { id: 'tool-7', label: '7) Send restock emails' },
    { id: 'tool-10', label: '10) Deactivate a meal' },
    { id: 'tool-13', label: '13) Clone a meal' },
    { id: 'tool-14', label: '14) Bulk-generate meals' },
    { id: 'tool-15', label: '15) Nuke demo data' },
  ]},
  { title: 'QR / Print', items: [
    { id: 'tool-16', label: '16) Generate QR invites' },
    { id: 'tool-17', label: '17) Sticker Sheet (PDF)' },
  ]},
];

export function AdminToolsPage() {
  const { user, ready } = React.useContext(CurrentUserContext);

  // ⬇️ Call hooks unconditionally on every render (prevents hook-order changes)
  const { busy, out, err, run } = useRunner();
  const [sharedEmail, setSharedEmail] = React.useState('chef.demo@example.com');

  const initialActive = React.useMemo(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      return window.location.hash.slice(1);
    }
    return GROUPS?.[0]?.items?.[0]?.id ?? null;
  }, []);

  const [activeId, setActiveId] = React.useState<string | null>(initialActive);

  React.useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-tool-section="true"]')
    );
    if (!sections.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveId(visible.target.id);
      },
      { root: null, threshold: [0.35, 0.5], rootMargin: '-10% 0px -40% 0px' }
    );

    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  };

  // ⬇️ Render gating AFTER hooks are declared
  if (!ready) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-muted-foreground">Checking your session… (AdminToolsPage)</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-muted-foreground">
          You’re not signed in. Please <a className="underline" href="/login?next=%2Fadmin%2Ftools">log in</a>.
        </p>
      </main>
    );
  }

  return (
    <main className="soft-borders mx-auto max-w-6xl p-6 pb-[350px] lg:pb-[420px]">
      <header id="top" className="mb-6 mt-12">
        <h1 className="text-2xl font-semibold">Admin Tools</h1>
        <p className="text-sm text-muted-foreground">
          Quick actions to seed accounts and move quickly in demos. Use the left
          nav to jump; press <kbd>/</kbd> to filter.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <LeftNav groups={GROUPS} activeId={activeId ?? undefined} onSelect={scrollTo} />

        <div className="space-y-8">
          <section id="tool-1" data-tool-section="true" className="scroll-mt-24">
            <CreateUserCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>
          <section id="tool-2" data-tool-section="true" className="scroll-mt-24">
            <PromoteChefCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>
          <section id="tool-3" data-tool-section="true" className="scroll-mt-24">
            <EnableComplianceCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>
          <section id="tool-4" data-tool-section="true" className="scroll-mt-24">
            <CreateMealCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>

          <section id="tool-5" data-tool-section="true" className="scroll-mt-24">
            <CreateDemoReviewsCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>
          <section id="tool-6" data-tool-section="true" className="scroll-mt-24">
            <RestockMealCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>
          <section id="tool-7" data-tool-section="true" className="scroll-mt-24">
            <SendRestockEmailsCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>

          <section id="tool-8" data-tool-section="true" className="scroll-mt-24">
            <MarkComplianceDocCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>
          <section id="tool-9" data-tool-section="true" className="scroll-mt-24">
            <SeedComplianceSetCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>
          <section id="tool-10" data-tool-section="true" className="scroll-mt-24">
            <DeactivateMealCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>
          <section id="tool-11" data-tool-section="true" className="scroll-mt-24">
            <CreateAiEndorsementCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>
          <section id="tool-12" data-tool-section="true" className="scroll-mt-24">
            <ApproveAllRequirementsCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>

          <section id="tool-13" data-tool-section="true" className="scroll-mt-24">
            <CloneMealCard run={run} isBusy={!!busy} />
          </section>
          <section id="tool-14" data-tool-section="true" className="scroll-mt-24">
            <BulkGenerateMealsCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>
          <section id="tool-15" data-tool-section="true" className="scroll-mt-24">
            <NukeDemoDataCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>
          <section id="tool-16" data-tool-section="true" className="scroll-mt-24">
            <GenerateQrInvitesCard run={run} isBusy={!!busy} emailState={sharedEmail} setEmailState={setSharedEmail} />
          </section>
          <section id="tool-17" data-tool-section="true" className="scroll-mt-24">
            <StickerSheetCard isBusy={!!busy} />
          </section>

          <StickyOutput busyLabel={busy} err={err} out={out} />

          <div className="pt-4">
            <button
              className="rounded-md px-3 py-2 text-sm hover:bg-muted"
              onClick={() => {
                const el = document.getElementById('top');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                else window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              ↑ Back to top
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
