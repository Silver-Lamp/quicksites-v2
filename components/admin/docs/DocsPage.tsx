import { marked } from 'marked';

export default function DocsPage({ markdown }: { markdown: string }) {
  const html = marked.parse(markdown);

  return (
    <div className="prose mx-auto max-w-4xl p-6">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
