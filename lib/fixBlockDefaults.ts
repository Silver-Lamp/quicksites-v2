import type { Block } from '@/types/blocks';

export function fixBlockDefaults(block: any): Block {
  if (!block.content && block.value) {
    block.content = block.value;
    delete block.value;
  }

  block._id ??= crypto.randomUUID();
  block.meta ??= {};
  block.tags ??= [];
  block.tone ??= 'neutral';
  block.industry ??= 'general';

  if (block.type === 'hero') {
    block.content.image_url ??= '';
    block.content.headline ??= 'Welcome!';
    block.content.cta_text ??= '';
    block.content.cta_link ??= '';
  }

  if (block.type === 'services') {
    block.content.items ??= ['Service A', 'Service B'];
  }

  if (block.type === 'testimonial') {
    block.content.quote ??= 'This is a testimonial';
  }

  if (block.type === 'cta') {
    block.content.label ??= 'Click Here';
    block.content.link ??= '#';
  }

  if (block.type === 'footer') {
    block.content.links ??= [];
    block.content.businessName ??= 'Business';
    block.content.address ??= '123 Main St';
    block.content.cityState ??= 'City, ST';
    block.content.phone ??= '(555) 555-5555';
  }

  if (block.type === 'grid') {
    block.content.columns ??= 2;
    block.content.items = (block.content.items ?? []).map(fixBlockDefaults);
  }

  return block as Block;
}

export function fixPageBlocks(page: any) {
  page.content_blocks = (page.content_blocks ?? []).map(fixBlockDefaults);
  return page;
}

export function fixTemplatePages(data: any) {
  data.pages = (data.pages ?? []).map(fixPageBlocks);
  return data;
}
