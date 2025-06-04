export type HeroBlockContent = {
    headline: string;
    subheadline?: string;
    cta_text?: string;
    cta_link?: string;
  };
  
  export type ServicesBlockContent = {
    items: string[];
  };
  
  export type TestimonialBlockContent = {
    quote: string;
    attribution?: string;
  };
  
  export type TextBlockContent = {
    value: string;
  };
  
  export type CtaBlockContent = {
    label: string;
    link: string;
  };
  
  export type QuoteBlockContent = {
    text: string;
    attribution?: string;
  };
  
  export type Block = {
    id?: string;
    type: string;
    content?:
      | HeroBlockContent
      | ServicesBlockContent
      | TestimonialBlockContent
      | TextBlockContent
      | CtaBlockContent
      | QuoteBlockContent
      | Record<string, any>;
  };
  
  export type PresetBlock = Record<string, any>;
  export type PresetMap = Record<string, Record<string, PresetBlock>>;
  
  export type BlocksEditorProps = {
    blocks: Block[];
    onChange: (updated: Block[]) => void;
    industry?: string;
  };
  
  export type BlockSidebarProps = {
    block: Block;
    onChange: (block: Block) => void;
    onClose: () => void;
  };
  
  export type BlockEditorModalProps = {
    block: Block;
    onSave: (updated: Block) => void;
    onClose: () => void;
  };
  
  export type ReorderableBlockListProps = {
    blocks: Block[];
    onBlockClick?: (block: Block) => void;
  };
  
  export type TemplatePageEditorProps = {
    pageIndex: number;
    blocks: Block[];
    onBlockChange: (pageIndex: number, updated: Block[]) => void;
  };
  
  export function normalizeBlock(block: Block): Block & { id: string } {
    return {
      ...block,
      id: block.id || crypto.randomUUID(),
    };
  }
  