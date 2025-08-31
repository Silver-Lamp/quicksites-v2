import type { SeedTemplateOptions, BlockKey } from './types';
import { buildBlock } from './blocks';

export function buildTemplateFromOptions(opts: SeedTemplateOptions) {
  const theme = opts.theme || 'light';
  const layout = opts.layout || 'standard';
  const siteName = opts.siteName || 'Demo';

  const picks = opts.picks || {};
  const order: BlockKey[] = Array.isArray(opts.order) && opts.order.length
    ? opts.order
    : ['header','hero','services','faq','contact_form','footer'];

  const content_blocks: any[] = [];
  for (const key of order) {
    const pick = picks[key];
    if (!pick?.enabled) continue;
    const block = buildBlock(key, pick.config, { siteName, serviceNames: opts.serviceNames || [] });
    if (block) content_blocks.push(block);
  }

  // Ensure hero exists for a welcoming page
  if (!content_blocks.some(b => b.type === 'hero')) {
    content_blocks.unshift(buildBlock('hero', {}, { siteName })!);
  }

  const pages = [{
    id: 'home',
    slug: 'home',
    title: 'Home',
    show_header: true,
    show_footer: true,
    content_blocks,
  }];

  return {
    theme,
    layout,
    pages,
  };
}
