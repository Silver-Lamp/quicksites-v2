/**
 * @jest-environment node
 *
 * THE SUGGESTION CARD HANDS THE ATTACH FORM ITS TWO FIELDS — it does not attach.
 *
 * ⚠️ What this protects is the TRANSCRIPTION, not the clicks. The values copied are a domain and
 * a ten-digit phone number, and a dropped digit does not fail: it attaches cleanly and routes a
 * stranger's 2am towing call to whoever owns the number that was actually typed. Nothing on the
 * admin page shows that afterwards.
 *
 * ⚠️ And it must stay a PREFILL. Attaching repoints a live number and texts a real business the
 * one-time notice, so the last click stays with the operator — who also has to choose which
 * Twilio number, a decision the suggestion cannot make.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';

const root = process.cwd();
const read = (p: string) => stripComments(readFileSync(join(root, p), 'utf8'));

const PAGE = read('app/admin/ppl/page.tsx');
const BUTTON = read('components/admin/ppl-use-suggestion.tsx');
const FORM = read('components/admin/ppl-attach-number-form.tsx');
const CONTRACT = read('components/admin/ppl-prefill.ts');

describe('the stripper left real code', () => {
  it('has content', () => {
    expect(PAGE).toContain('PplUseSuggestion');
    expect(FORM).toContain('PplAttachNumberForm');
  });
});

describe('the handoff is wired end to end', () => {
  it('both sides use the shared event name, not a literal', () => {
    // A renamed string on one side makes the button silently do nothing — the failure mode a
    // CustomEvent handoff is most prone to.
    expect(CONTRACT).toContain('PPL_PREFILL_EVENT');
    expect(BUTTON).toContain('PPL_PREFILL_EVENT');
    expect(FORM).toContain('PPL_PREFILL_EVENT');
    expect(BUTTON).not.toMatch(/'qs:ppl-prefill'/);
    expect(FORM).not.toMatch(/'qs:ppl-prefill'/);
  });

  it('the card passes the recommended number, not just the domain', () => {
    expect(PAGE).toMatch(/forwardTo=\{r\.ranked\[0\]\.prospect\.phone/);
  });

  it('the form listens and removes its listener', () => {
    expect(FORM).toContain('addEventListener(PPL_PREFILL_EVENT');
    expect(FORM).toContain('removeEventListener(PPL_PREFILL_EVENT');
  });
});

describe('it prefills — it never attaches', () => {
  it('the button does not call the attach endpoint', () => {
    expect(BUTTON).not.toContain('attach-number');
    expect(BUTTON).not.toContain('fetch(');
  });

  it('the attach request is still made only by the form', () => {
    expect(FORM).toContain('geo-campaign/attach-number');
  });

  it('the form still confirms before attaching', () => {
    // Repointing a live number and texting a stranger is not a thing to do on a stray click.
    expect(FORM).toContain('window.confirm');
  });
});

describe('the copy does not invent a second step', () => {
  it('no longer tells the operator to send the notice separately', () => {
    // attach-number calls sendForwardNotice unless the box is unticked, so "attach it, then send
    // the forwarding notice" described two steps where there is one — and sent someone looking
    // for a button that does not exist.
    expect(PAGE).not.toMatch(/then send the\s+forwarding notice/);
    expect(PAGE).toMatch(/attaching also texts them/i);
  });
});
