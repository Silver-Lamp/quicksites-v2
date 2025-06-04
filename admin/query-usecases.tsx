import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';

export async function getStaticProps() {
  const filePath = path.join(process.cwd(), 'docs/query-usecases.md');
  const content = fs.readFileSync(filePath, 'utf8');
  return { props: { content } };
}

export default function QueryUsecases({ content }: { content: string }) {
  return (
    <div className="p-8 max-w-4xl mx-auto text-white">
      <h1 className="text-2xl font-bold mb-4">Query Param Use Cases</h1>
      <ReactMarkdown className="prose prose-invert">{content}</ReactMarkdown>
    </div>
  );
}
