// app/for-daryle/tools.tsx — Daryle's tool list over the shared card (components/for-rep/tools-card.tsx).
// Daryle's network is payment processors; his partner code is `daryle24`.
import ToolsCard, { type Tool } from '@/components/for-rep/tools-card';

const CODE = 'daryle24';

const TOOLS: Tool[] = [
  { title: 'Partner dashboard', line: 'Your referred merchants, the people under you, payouts.', href: '/partners/dashboard', auth: true },
  { title: 'Referral earnings', line: 'Signups, accrued, held and paid under your code.', href: '/referrals/dashboard', auth: true },
  { title: 'The partner program', line: 'The white-label program a processor would join.', href: '/partners', auth: false },
  { title: 'Earnings calculator', line: 'Drag the sliders, see the curves at book scale.', href: '/partners/calculator', auth: false },
  { title: 'Compare', line: 'The honest feature chart vs Duda and GoHighLevel.', href: '/compare', auth: false },
  { title: 'Spread the word', line: 'The public page anyone can share.', href: '/spread-the-word', auth: false },
];

export default function DaryleTools() {
  return <ToolsCard tools={TOOLS} code={CODE} />;
}
