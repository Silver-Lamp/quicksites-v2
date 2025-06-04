// types/page.ts

export type Block = {
    type: string;
    value: any;
  };
  
  export type Page = {
    id: string;
    slug: string;
    title: string;
    content_blocks: Block[];
  };
  