// app/for-amy/tools.tsx — Amy's tool list over the shared card (components/for-rep/tools-card.tsx).
// Amy manages closers on the rental rail (her partner code is `amyjurowski`; her override is the
// subject of her page), so her tools are the dashboards plus the sales kit the reps use.
import ToolsCard, { type Tool } from '@/components/for-rep/tools-card';

const CODE = 'amyjurowski';

const TOOLS: Tool[] = [
  { title: 'Partner dashboard', line: 'Your overrides, the people under you, payouts.', href: '/partners/dashboard', auth: true },
  { title: 'Referral earnings', line: 'Signups, accrued, held and paid under your code.', href: '/referrals/dashboard', auth: true },
  { title: 'The rep brief', line: 'What the reps are actually selling, and how it pays.', href: '/for-sales', auth: false },
  { title: 'Practice a call', line: 'Rehearse the pitch against a simulated owner before a real one.', href: '/for-sales/call', auth: false },
  { title: 'Rate card', line: 'The rental tiers and what each rung takes home.', href: '/for-sales/rate-card', auth: false },
  { title: 'Plan a route', line: 'Paste the day’s stops, get an efficient order and a Maps link.', href: '/tools/route-planner', auth: false },
  { title: 'Spread the word', line: 'The public page anyone can share.', href: '/spread-the-word', auth: false },
  { title: 'Daryle’s page', line: 'The processor side of the same chain.', href: '/for-daryle', auth: false },
];

export default function AmyTools() {
  return <ToolsCard tools={TOOLS} code={CODE} />;
}
