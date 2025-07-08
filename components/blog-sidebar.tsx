// components/blog-sidebar.tsx
import QueryLink from '@/components/query-link';
import { blogQuerySchema } from '@/lib/querySchemas/blog';

<QueryLink
  schema={blogQuerySchema}
  pathname="/blog"
  params={{ category: 'ai', tag: 'transformers' }}
  className="text-blue-400 hover:underline"
>
  AI + Transformers
</QueryLink>
