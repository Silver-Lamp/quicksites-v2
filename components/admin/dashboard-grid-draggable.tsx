// ✅ FILE: /components/admin/DashboardGridDraggable.tsx

'use client';

import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { AddBlockMenu } from './add-block-menu';
import { useState } from 'react';
import BlockSettingsModal from './block-settings-modal';

const ALL_BLOCKS = [
  { id: 'activity', title: 'Activity' },
  { id: 'engagement', title: 'Engagement' },
  { id: 'retention', title: 'Retention' },
  { id: 'traffic', title: 'Traffic' },
];

export default function DashboardGridDraggable({
  renderers,
  order,
  hidden,
  onSave,
  onAddBlock,
  settings,
  updateBlockSetting,
}: {
  renderers: { [key: string]: React.ReactNode };
  order: { id: string; title: string }[];
  hidden: string[];
  onSave: (order: any[], hidden: string[]) => void;
  onAddBlock?: (block: { id: string; title: string }) => void;
  settings: Record<string, any>;
  updateBlockSetting: (blockId: string, key: string, value: any) => void;
}) {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const updated = [...order];
    const [moved] = updated.splice(result.source.index, 1);
    updated.splice(result.destination.index, 0, moved);
    onSave(updated, hidden);
  };

  const toggleVisibility = (id: string) => {
    const updated = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
    onSave(order, updated);
  };

  const availableToAdd = ALL_BLOCKS.filter((b) => !order.some((o) => o.id === b.id));

  return (
    <>
      {onAddBlock && availableToAdd.length > 0 && (
        <AddBlockMenu available={availableToAdd} onAdd={onAddBlock} />
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        {order.map((block) => (
          <label key={block.id} className="text-sm">
            <input
              type="checkbox"
              checked={!hidden.includes(block.id)}
              onChange={() => toggleVisibility(block.id)}
              className="mr-1"
            />
            {block.title}
          </label>
        ))}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dashboard">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {order.map((block, index) =>
                hidden.includes(block.id) ? null : (
                  <Draggable key={block.id} draggableId={block.id} index={index}>
                    {(draggable) => (
                      <div
                        ref={draggable.innerRef}
                        {...draggable.draggableProps}
                        {...draggable.dragHandleProps}
                        className="bg-white dark:bg-zinc-900 border rounded shadow p-4"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold">{block.title}</span>
                          <button
                            onClick={() => setEditingBlockId(block.id)}
                            title="Edit settings"
                            className="text-xs text-gray-400 hover:text-white"
                          >
                            ⚙️
                          </button>
                        </div>
                        {renderers?.[block.id] ?? (
                          <div className="text-red-500 text-sm">
                            ⚠️ Missing renderer for <code>{block.id}</code>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                )
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {editingBlockId && (
        <BlockSettingsModal
          blockId={editingBlockId}
          settings={settings[editingBlockId] || {}}
          onClose={() => setEditingBlockId(null)}
          onSave={(updated) => {
            Object.entries(updated).forEach(([key, value]) => {
              updateBlockSetting(editingBlockId, key, value);
            });
          }}
        />
      )}
    </>
  );
}
