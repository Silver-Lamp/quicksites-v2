// lib/talkingDemo/__tests__/buildTourScript.test.ts
import { buildTourSteps, buildTalkingDemoScript } from '../buildTourScript';
import { MAX_STEPS, MAX_SAY_CHARS } from '../types';

const block = (type: string, content: any) => ({ type, content });

describe('buildTourSteps', () => {
  it('tours a real-estate agency site in order (welcome → roster → listings → contact)', () => {
    const steps = buildTourSteps('Cedar & Vine Realty', [
      block('hero', { subheadline: 'A boutique brokerage for the valley.' }),
      block('agent_roster', { agents: [{ name: 'Jordan Avery' }, { name: 'Priya Nair' }, { name: 'Marcus Bellamy' }] }),
      block('listings_grid', { listings: [{ headline: '142 Maple' }, { headline: '8 Vineyard' }] }),
      block('contact_form', {}),
    ]);
    expect(steps[0].caption).toBe('Welcome');
    expect(steps[0].say).toContain('Cedar & Vine Realty');
    expect(steps.map((s) => s.caption)).toEqual(['Welcome', 'Meet the team', 'Current listings', 'Get in touch']);
    expect(steps.find((s) => s.caption === 'Meet the team')!.say).toContain('Jordan Avery');
  });

  it('tours a restaurant (hero + menu) and adds a closer when there is no contact block', () => {
    const steps = buildTourSteps('Field & Oak', [
      block('hero', { subheadline: 'Fresh-roasted coffee.' }),
      block('menu', { sections: [{ items: [{ name: 'Cortado' }, { name: 'Cold brew' }] }] }),
    ]);
    expect(steps.map((s) => s.caption)).toContain('The menu');
    expect(steps[steps.length - 1].caption).toBe('Thanks for visiting'); // synthesized closer
  });

  it('skips un-narratable blocks and de-dupes repeated types', () => {
    const steps = buildTourSteps('X', [
      block('announcement_bar', { message: 'hi' }),
      block('image', { url: 'a.jpg' }),
      block('services', { items: ['Towing', 'Jump starts'] }),
      block('services', { items: ['Ignore the second one'] }),
    ]);
    const services = steps.filter((s) => s.caption === 'What they do');
    expect(services).toHaveLength(1);
    expect(services[0].say).toContain('Towing');
    expect(steps.some((s) => s.caption === 'Welcome')).toBe(true); // synthesized (no hero)
  });

  it('always yields a welcome first, and never exceeds the step/char caps', () => {
    const many = Array.from({ length: 60 }, (_, i) => block('faq', { items: [{ question: `Q${i}?`, answer: 'A'.repeat(500) }] }));
    const steps = buildTourSteps('Big Co', many);
    expect(steps.length).toBeLessThanOrEqual(MAX_STEPS);
    expect(steps[0].caption).toBe('Welcome');
    for (const s of steps) expect(s.say.length).toBeLessThanOrEqual(MAX_SAY_CHARS);
  });

  it('buildTalkingDemoScript wraps steps with the render payload fields', () => {
    const script = buildTalkingDemoScript({
      instanceRef: 'tpl_123',
      businessName: 'Acme',
      blocks: [block('hero', { subheadline: 'We do things.' })],
      voice: 'owner_clone',
      wantMp4: false,
    });
    expect(script.instance_ref).toBe('tpl_123');
    expect(script.voice).toBe('owner_clone');
    expect(script.want_mp4).toBe(false);
    expect(script.steps[0].caption).toBe('Welcome');
  });
});
