/**
 * @jest-environment node
 */
// A template flagged meta.sample (our fictional starter shown on the Evolve page) has no stale
// price to hide; a real business's undated menu still does.
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';
import { freshnessForTemplate, freshnessNote } from '@/lib/menu/menuFreshness';

describe('freshnessForTemplate', () => {
  it('a sample template is fresh regardless of dates; anything else follows the rule', () => {
    const sample = freshnessForTemplate({ sections: [] }, { meta: { sample: true } });
    expect(sample.pricesStale).toBe(false);
    expect(freshnessNote(sample)).toBeNull();
    expect(freshnessNote(freshnessForTemplate({ sections: [] }, { meta: {} }))).toMatch(/Prices unconfirmed/);
    expect(freshnessForTemplate({ sections: [] }, { meta: {} }).pricesStale).toBe(true);
    expect(freshnessForTemplate({ sections: [] }, null).pricesStale).toBe(true);
    expect(freshnessForTemplate({ sections: [], sourced_at: new Date().toISOString() }, null).pricesStale).toBe(false);
  });
  it('the menu renderer decides through it', () => {
    const src = stripComments(fs.readFileSync(path.join(process.cwd(), 'components/admin/templates/render-blocks/menu.tsx'), 'utf8'));
    expect(src).toMatch(/freshnessForTemplate\(content, props\?\.template\?\.data/);
    expect(src).not.toMatch(/assessFreshness\(content\)/);
  });
});
