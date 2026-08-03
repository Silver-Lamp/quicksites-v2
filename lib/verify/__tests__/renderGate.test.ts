/**
 * @jest-environment node
 */
// The rules are pure, so they are testable without Chromium — which matters, because a gate
// nobody can test is a gate that rots into a permanently-green row.
//
// Each case below is a failure that actually shipped on a client's site.
import { runRules, defaultRules, summarize, type Rule } from '../renderGate';
import type { RenderedPage } from '../extract';

function page(nodes: [string, number][], extra: Partial<RenderedPage> = {}): RenderedPage {
  return {
    url: 'https://example.quicksites.ai/',
    title: 'x',
    visibleText: nodes.map(([t]) => t).join('\n'),
    nodes: nodes.map(([text, y]) => ({ text, y, x: 0, tag: 'P' })),
    controls: [],
    contrast: [],
    scanned: { elements: 100, visibleNodes: nodes.length },
    ...extra,
  };
}

describe('copy_present — the block content that lost to the template', () => {
  const rules: Rule[] = [{ kind: 'copy_present', text: 'Cloud bill review' }];

  it('passes when the written copy is on the rendered page', () => {
    expect(runRules(page([['Cloud bill review', 500]]), rules)[0].status).toBe('pass');
  });

  // The real bug: the block content was correct in the DB, in the editor, and in every
  // block-level check — and the page showed the industry scaffold's generic list.
  it('fails when the page shows something else entirely', () => {
    const f = runRules(page([['Consulting', 500], ['Installation', 520]]), rules)[0];
    expect(f.status).toBe('fail');
    expect(f.detail).toMatch(/losing to something upstream/);
  });

  it('ignores whitespace and smart quotes', () => {
    expect(runRules(page([['  You’re   welcome  ', 1]]), [{ kind: 'copy_present', text: "you're welcome" }])[0].status).toBe('pass');
  });
});

describe('order — the disclosure that rendered below the upload control', () => {
  const rule: Rule = {
    kind: 'order',
    before: 'I am paid by the provider',
    afterControls: ['file'],
    label: 'disclosure before upload',
  };

  it('passes when the disclosure comes first', () => {
    const p = page([['I am paid by the provider', 700]], { controls: [{ kind: 'file', text: '', y: 1100 }] });
    expect(runRules(p, [rule])[0].status).toBe('pass');
  });

  // C shipped exactly this: disclosure at y=1662, upload control at y=1070.
  it('fails when the visitor reaches the control first', () => {
    const p = page([['I am paid by the provider', 1662]], { controls: [{ kind: 'file', text: '', y: 1070 }] });
    const f = runRules(p, [rule])[0];
    expect(f.status).toBe('fail');
    expect(f.detail).toMatch(/WRONG ORDER/);
  });

  it('fails when the disclosure is missing entirely but the control is there', () => {
    const p = page([['Upload your bill', 100]], { controls: [{ kind: 'file', text: '', y: 200 }] });
    expect(runRules(p, [rule])[0].status).toBe('fail');
  });

  // ⚠️ The load-bearing one. A rule whose "after" side is absent has been SKIPPED, not satisfied.
  // Reporting it as a pass is the silence-looks-like-success failure this repo keeps hitting.
  it('is inapplicable — NOT a pass — when there is no control to order against', () => {
    const p = page([['I am paid by the provider', 700]]);
    const f = runRules(p, [rule])[0];
    expect(f.status).toBe('inapplicable');
    expect(f.status).not.toBe('pass');
    expect(summarize([f]).inapplicable).toBe(1);
    expect(summarize([f]).passed).toBe(0);
  });
});

describe('no_owner_strings — text addressed to whoever built the site', () => {
  it('catches the renderer error that reached a live page', () => {
    const f = runRules(page([['⚠️ No renderer for block type: cloud_savings_agency', 300]]), [{ kind: 'no_owner_strings' }])[0];
    expect(f.status).toBe('fail');
  });

  it('catches raw JSON published on a person’s biography', () => {
    const f = runRules(page([['{"type":"hero","content":{"headline":"x"}}', 400]]), [{ kind: 'no_owner_strings' }])[0];
    expect(f.status).toBe('fail');
    expect(f.detail).toMatch(/raw JSON/);
  });

  // Prose that merely starts with a brace is not a leaked object.
  it('does not cry wolf on ordinary text', () => {
    const p = page([['[Editor’s note] we love this place {really}', 10], ['Everything is fine', 20]]);
    expect(runRules(p, [{ kind: 'no_owner_strings' }])[0].status).toBe('pass');
  });
});

describe('min_contrast — the shared wrapper that hard-coded text-white', () => {
  it('fails on white-on-white', () => {
    const p = page([['Skills', 100]], { contrast: [{ text: 'Skills', ratio: 1.02, y: 100 }] });
    expect(runRules(p, [{ kind: 'min_contrast', ratio: 3 }])[0].status).toBe('fail');
  });

  it('passes normal text', () => {
    const p = page([['Skills', 100]], { contrast: [] });
    expect(runRules(p, [{ kind: 'min_contrast', ratio: 3 }])[0].status).toBe('pass');
  });
});

describe('an empty render', () => {
  // The SSR-empty-shell bug fleet-wide. One plain finding beats a pile of confusing ones.
  it('says the page rendered nothing, once', () => {
    const f = runRules(page([]), defaultRules({ mustContain: ['anything'] }));
    expect(f).toHaveLength(1);
    expect(f[0].rule).toBe('rendered');
    expect(f[0].detail).toMatch(/rendered nothing/);
  });
});

describe('summarize', () => {
  it('never counts an inapplicable rule as ok-by-omission', () => {
    const findings = runRules(
      page([['hello', 1]]),
      [{ kind: 'order', before: 'hello', afterControls: ['file'], label: 'x' }],
    );
    const s = summarize(findings);
    expect(s.ok).toBe(true);          // nothing FAILED…
    expect(s.inapplicable).toBe(1);   // …but the caller can see this proved nothing
  });
});
