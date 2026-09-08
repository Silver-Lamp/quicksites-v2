/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { tradeSitesFlowNodes } from '@/components/business-plan/trade-sites-flow';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const FLOW = read('components/business-plan/trade-sites-flow.tsx');
const BODY = read('components/business-plan/plan-body.tsx');

describe('the trade-site loop diagram on the business plan', () => {
  it('shows the three counts the vertical is judged on, read from evidence, never typed', () => {
    const nodes = tradeSitesFlowNodes({ tradeDrafts: 12, tradeClaimed: 3, tradePaid: 1 });
    const counts = nodes.filter((n) => n.count).map((n) => [n.count!.label, n.count!.value]);
    expect(counts).toEqual([['drafts built', 12], ['claimed', 3], ['paid', 1]]);
    for (const k of ['tradeDrafts', 'tradeClaimed', 'tradePaid']) expect(FLOW).toContain(k);
  });

  it('states no dollar figure — the price lives with the vertical that owns it', () => {
    const hardcodedMoney = /\$[\d,]+(\.\d{2})?(?![\d)])/g;
    expect(FLOW.match(hardcodedMoney) || []).toEqual([]);
  });

  it('draws the whole loop, in order, and says who does each step', () => {
    const nodes = tradeSitesFlowNodes({ tradeDrafts: 0, tradeClaimed: 0, tradePaid: 0 });
    expect(nodes.map((n) => n.who)).toEqual(['person', 'auto', 'auto', 'auto', 'business', 'auto', 'business']);
    // Exactly one step is an operator's decision — the diagram must not claim more automation than exists.
    expect(nodes.filter((n) => n.who === 'person')).toHaveLength(1);
  });

  it('renders only on the trade-sites vertical, from the same evidence as the rest of the page', () => {
    expect(BODY).toMatch(/vertical\.key === 'trade_sites' && <TradeSitesFlow evidence=\{e\} \/>/);
  });

  it('never reaches the database from the component itself', () => {
    expect(FLOW).not.toMatch(/supabase/);
    expect(FLOW).toMatch(/^import type \{ PlanEvidence \}/m);
  });
});
