export default function WysiwygPreview({ layout }: { layout: any[] }) {
  return (
    <div className="p-4 border rounded space-y-4 bg-white max-w-xl mx-auto">
      {layout
        .filter((b) => b.active)
        .map((block, index) => (
          <div key={block.type + index} className="border rounded p-4">
            {block.type === 'hero' && (
              <div className="text-center">
                <h2 className="text-2xl font-bold">Hero Title</h2>
                <p className="text-sm text-gray-500">Your site’s top message</p>
              </div>
            )}
            {block.type === 'features' && (
              <ul className="list-disc pl-5 text-sm">
                <li>Feature One</li>
                <li>Feature Two</li>
                <li>Feature Three</li>
              </ul>
            )}
            {block.type === 'testimonials' && (
              <blockquote className="italic text-sm text-gray-700">
                “This changed my business!”
              </blockquote>
            )}
            {block.type === 'cta' && (
              <div className="text-center">
                <button className="bg-blue-600 text-white px-4 py-2 rounded">Get Started</button>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
