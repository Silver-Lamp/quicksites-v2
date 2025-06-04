import RenderBlock from '@/components/admin/templates/RenderBlock';

export default function TemplatePreview({
  data,
  colorScheme = 'blue',
  theme = 'dark',
  brand = 'blue'
}: {
  data: any;
  colorScheme?: string;
  theme?: 'dark' | 'light';
  brand?: string;
}) {
  const themeClasses = theme === 'dark'
    ? 'bg-gray-900 text-white'
    : 'bg-white text-black';

  const brandClass = brand === 'green'
    ? 'text-green-400'
    : brand === 'red'
    ? 'text-red-400'
    : 'text-blue-400';

  const accentBg = colorScheme === 'red'
    ? 'bg-red-600'
    : colorScheme === 'green'
    ? 'bg-green-600'
    : colorScheme === 'yellow'
    ? 'bg-yellow-500'
    : 'bg-blue-600';

  return (
    <div className={`rounded-md p-6 ${themeClasses}`}>
      {data?.pages?.map((page: any, i: number) => (
        <div key={i} className="mb-6">
          <h2 className={`text-lg font-bold mb-2 ${brandClass}`}>Page: {page.slug}</h2>
          <div className="space-y-4">
            {page.content_blocks?.map((block: any, j: number) => (
              <RenderBlock key={j} block={block} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
