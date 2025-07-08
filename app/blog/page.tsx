// app/blog/page.tsx
import {
    getStaticBlogParams,
    stringifyBlogParams,
    blogQuerySchema,
  } from '@/lib/querySchemas/blog';
  import QueryButton from '@/components/query-button';
  import { z } from 'zod';
  const categories = ['ai', 'design', 'code'] as const;
  const tags = ['', 'transformers', 'ux', 'typescript'];
  
  type Category = (typeof categories)[number];
  
  // 👇 Ensure combos match schema types
  const comboPresets: Array<Partial<z.infer<typeof blogQuerySchema>>> = categories.flatMap((category) =>
    tags.map((tag) => ({
      category: category as Category,
      ...(tag ? { tag } : {}),
    }))
  );
  
  export async function generateStaticParams() {
    return getStaticBlogParams(comboPresets);
  }
  
  export function generateMetadata({ searchParams }: { searchParams: Record<string, string> }) {
    const parsed = blogQuerySchema.parse(searchParams);
    const title = parsed.tag
      ? `Blog: ${parsed.category} - ${parsed.tag}`
      : `Blog: ${parsed.category}`;
  
    return {
      title,
      description: `Articles on ${parsed.category}${parsed.tag ? ' tagged ' + parsed.tag : ''}.`,
    };
  }
  