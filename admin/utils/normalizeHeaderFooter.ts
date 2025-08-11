// admin/utils/normalizeHeaderFooter.ts
import type { Template, Page } from '@/types/template';
import type { Block } from '@/types/blocks';

const isHeader = (b: Block) => b.type === 'header';
const isFooter = (b: Block) => b.type === 'footer';

export function hoistHeaderFooter(tpl: any): Template {
  const template = { ...tpl } as Template;
  const pages = (template.data?.pages ?? template.pages ?? []) as Page[];
  if (!pages.length) return template;

  let header: Block | undefined = template.headerBlock;
  let footer: Block | undefined = template.footerBlock;

  const first = { ...pages[0] };
  const remainingHeader = [];
  const remainingFooter = [];

  // If header/footer not set globally, lift the first occurrences from the first page
  if (!header || !footer) {
    const newBlocks: Block[] = [];
    for (const b of first.content_blocks ?? []) {
      if (!header && isHeader(b)) { header = b; continue; }
      if (!footer && isFooter(b)) { footer = b; continue; }
      newBlocks.push(b);
    }
    first.content_blocks = newBlocks;
  }

  // Remove any stray header/footer blocks from all pages
  const cleanedPages = [first, ...pages.slice(1)].map((p) => ({
    ...p,
    content_blocks: (p.content_blocks ?? []).filter((b) => !isHeader(b) && !isFooter(b)),
  }));

  return {
    ...template,
    headerBlock: header ?? template.headerBlock,
    footerBlock: footer ?? template.footerBlock,
    data: { ...(template.data ?? {}), pages: cleanedPages },
    pages: cleanedPages, // keep legacy readers in sync
  };
}
