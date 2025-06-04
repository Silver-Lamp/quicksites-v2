'use client';

import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const DEFAULT_BLOCKS = [
  { id: 'activity', title: 'Activity' },
  { id: 'engagement', title: 'Engagement' },
  { id: 'retention', title: 'Retention' },
];

export default function DashboardGrid({
  renderers
}: {
  renderers: { [key: string]: React.ReactNode };
}) {
  const [order, setOrder] = useState(DEFAULT_BLOCKS);
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('dashboard-order');
    const vis = localStorage.getItem('dashboard-hidden');
    if (saved) setOrder(JSON.parse(saved));
    if (vis) setHidden(JSON.parse(vis));
  }, []);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const updated = Array.from(order);
    const [moved] = updated.splice(result.source.index, 1);
    updated.splice(result.destination.index, 0, moved);
    setOrder(updated);
    localStorage.setItem('dashboard-order', JSON.stringify(updated));
  };

  const toggleVisibility = (id: string) => {
    const updated = hidden.includes(id)
      ? hidden.filter((h) => h !== id)
      : [...hidden, id];
    setHidden(updated);
    localStorage.setItem('dashboard-hidden', JSON.stringify(updated));
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        {order.map((b) => (
          <label key={b.id} className="text-sm">
            <input
              type="checkbox"
              checked={!hidden.includes(b.id)}
              onChange={() => toggleVisibility(b.id)}
              className="mr-1"
            />
            {b.title}
          </label>
        ))}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dashboard">
          {(provided) => (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {order.map((block, index) =>
                hidden.includes(block.id) ? null : (
                  <Draggable key={block.id} draggableId={block.id} index={index}>
                    {(draggable) => (
                      <div
                        ref={draggable.innerRef}
                        {...draggable.draggableProps}
                        {...draggable.dragHandleProps}
                        className="bg-white border rounded shadow p-4"
                      >
                        <div className="font-semibold mb-2">{block.title}</div>
                        {renderers[block.id]}
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
    </>
  );
}
