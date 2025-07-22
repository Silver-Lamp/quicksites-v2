'use client';

import { useState } from 'react';
import type { BlockEditorProps } from './index';
import type { Block } from '@/types/blocks';
import BlockField from './block-field';
import { extractFieldErrors } from '../utils/extractFieldErrors';

type FAQBlock = Extract<Block, { type: 'faq' }>;

export default function FaqEditor({ block, onSave, onClose, errors = {}, template }: BlockEditorProps) {
  const faqBlock = block as FAQBlock;
  const [title, setTitle] = useState(faqBlock.content.title || 'Frequently Asked Questions');
  const [items, setItems] = useState(faqBlock.content.items || []);
  const fieldErrors = extractFieldErrors(errors as unknown as string[]);

  const updateItem = (i: number, key: 'question' | 'answer', value: string) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [key]: value };
    setItems(updated);
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit FAQ</h3>

      <BlockField
        type="text"
        label="Section Title"
        value={title}
        onChange={(v) => setTitle(v)}
        error={fieldErrors?.title}
      />

      {items.map((item, i) => (
        <div key={i} className="border border-white/10 p-3 rounded space-y-2">
          <BlockField
            type="text"
            label={`Question ${i + 1}`}
            value={item.question}
            onChange={(v) => updateItem(i, 'question', v)}
          />
          <BlockField
            type="text"
            label={`Answer ${i + 1}`}
            value={item.answer}
            onChange={(v) => updateItem(i, 'answer', v)}
          />
        </div>
      ))}

      <div className="flex gap-2">
        <button
          onClick={() => setItems([...items, { question: 'New Question', answer: 'New Answer' }])}
          className="text-sm text-green-400 underline"
        >
          + Add Q&A
        </button>
        {items.length > 1 && (
          <button
            onClick={() => setItems(items.slice(0, -1))}
            className="text-sm text-red-400 underline"
          >
            − Remove Last
          </button>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => onSave({ ...faqBlock, content: { title, items } })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}
