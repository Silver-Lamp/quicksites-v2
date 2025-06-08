
  const seo = usePageSeo({
    description: 'Manifesto page.',
    
  });
export default function ManifestoPage() {
  return (<>
      <NextSeo {...seo} />
    <div className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-3xl font-bold mb-6">📜 QuickSites Manifesto</h1>
      <p className="text-zinc-300 mb-4">
        We believe in transparent publishing, local stewardship, and civic infrastructure that belongs to everyone.
      </p>
      <ul className="list-disc pl-6 space-y-2 text-zinc-400">
        <li>No lock-in. Your content, your rules.</li>
        <li>Every claimed site is visible. Every change leaves a trace.</li>
        <li>Stewards earn trust through action, not permissions.</li>
        <li>Templates are shared. Rewards are public. AI is optional.</li>
        <li>We start from trust, default to simplicity, and publish in sunlight.</li>
      </ul>
      <p className="text-sm text-zinc-500 mt-6">Signed by early stewards and quiet contributors.</p>
    </div>
  );
}
