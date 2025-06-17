// types/block.ts

export type TextBlock = {
  type: 'text';
  value: string;
};

export type ImageBlock = {
  type: 'image';
  value: {
    url: string;
    alt: string;
  };
};

export type VideoBlock = {
  type: 'video';
  value: {
    url: string;
    caption?: string;
  };
};

export type AudioBlock = {
  type: 'audio';
  value: {
    provider: 'spotify' | 'soundcloud' | 'suno';
    url: string;
    title?: string;
  };
};

export type QuoteBlock = {
  type: 'quote';
  value: {
    text: string;
    author?: string;
  };
};

export type ButtonBlock = {
  type: 'button';
  value: {
    label: string;
    href: string;
    style?: 'primary' | 'secondary' | 'ghost';
  };
};

export type GridBlock = {
  type: 'grid';
  value: {
    columns: number;
    items: Block[];
  };
};

export type Block =
  | TextBlock
  | ImageBlock
  | VideoBlock
  | AudioBlock
  | QuoteBlock
  | ButtonBlock
  | GridBlock;
