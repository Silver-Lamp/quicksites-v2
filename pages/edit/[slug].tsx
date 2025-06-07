'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { BlocksEditor } from '@/components/editor/BlocksEditor';
import { SuggestBlockButton } from '@/components/SuggestBlockButton';

export default function EditPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [templateData, setTemplateData] = useState(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/template?domain=${slug}`)
      .then(res => res.json())
      .then((d) => setTemplateData(d?.data));
  }, [slug]);

  const save = async () => {
    await fetch('/api/save-template', {
      method: 'POST',
      body: JSON.stringify({ domain: slug, data: templateData }),
    });
    alert('Saved!');
  };

  if (!templateData) return <div className="text-white p-6">Loading...</div>;

  return (
    <div className="text-white p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">✏️ Editing: {slug}</h1>
      <BlocksEditor data={templateData} onChange={setTemplateData}>
        {(block) => (
          <>
            {block.type === 'hero' || block.type === 'services' ? (
              <SuggestBlockButton
                type={block.type}
                onSuggest={(s) => {
                  const updated = templateData.blocks.map((b) =>
                    b.id === block.id ? { ...b, content: s } : b
                  );
                  setTemplateData({ ...templateData, blocks: updated });
                }}
              />
            ) : null}
          </>
        )}
      </BlocksEditor>
      <button
        className="mt-6 px-4 py-2 rounded bg-green-600 hover:bg-green-700"
        onClick={save}
      >
        Save Changes
      </button>
    </div>
  );
}
