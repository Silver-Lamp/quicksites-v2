// app/for-daniel/tools.tsx — Daniel's tool list over the shared card (components/for-rep/tools-card.tsx).
import ToolsCard, { type Tool } from '@/components/for-rep/tools-card';

const PARTNER_CODE = 'daniel';

const TOOLS: Tool[] = [
  { title: 'Partner dashboard', line: 'Your reps, the white-label steps, payouts, earnings by restaurant.', href: '/partners/dashboard', auth: true },
  { title: 'Add a rep', line: 'Name, email, city — mints their code and their page.', href: '/partners/dashboard#reps', auth: true },
  { title: 'Referral earnings', line: 'Signups, accrued, held and paid under your code.', href: '/referrals/dashboard', auth: true },
  { title: 'Plan a route', line: 'Paste the day’s stops, get an efficient order and a Maps link.', href: '/tools/route-planner', auth: false },
  { title: 'Toast vs. us', line: 'The honest comparison for a restaurant already on Toast or Square.', href: '/compare/toast', auth: false },
  { title: 'Spread the word', line: 'The public page you can share with anyone who knows a restaurant.', href: '/spread-the-word', auth: false },
];

export default function DanielTools() {
  return <ToolsCard tools={TOOLS} code={PARTNER_CODE} reps />;
}
