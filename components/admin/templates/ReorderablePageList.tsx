import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import TemplatePreview from './TemplatePreview';

type ReorderablePageListProps = {
  template: any;
  pages: any[];
  colorScheme: string;
  onBlockClick?: (block: any) => void;
  onReorder: (pages: any[]) => void;
};

function SortablePage({
  id,
  children
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 1
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="group relative border rounded mb-6">
      <div
        {...listeners}
        className="absolute -left-6 top-2 text-gray-300 group-hover:text-gray-600 cursor-grab"
      >
        ☰
      </div>
      {children}
    </div>
  );
}

export default function ReorderablePageList({
  pages,
  colorScheme,
  onBlockClick,
  onReorder
}: ReorderablePageListProps) {
  const sensors = useSensors(useSensor(PointerSensor));

  const getId = (page: any, index: number) =>
    page.slug || page._id || `page-${index}`;

  const handleSlugChange = (index: number, newSlug: string) => {
    const updated = [...pages];
    updated[index].slug = newSlug;
    onReorder(updated);
  };

  const handleDelete = (index: number) => {
    const confirmed = confirm('Delete this page?');
    if (!confirmed) return;
    const updated = pages.filter((_, i) => i !== index);
    onReorder(updated);
  };

  const handleDuplicate = (index: number) => {
    const clone = { ...pages[index], slug: pages[index].slug + '-copy' };
    const updated = [...pages.slice(0, index + 1), clone, ...pages.slice(index + 1)];
    onReorder(updated);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        const oldIndex = pages.findIndex((p, i) => getId(p, i) === active.id);
        const newIndex = pages.findIndex((p, i) => getId(p, i) === over.id);
        const updated = arrayMove(pages, oldIndex, newIndex);
        onReorder(updated);
      }}
    >
      <SortableContext
        items={pages.map(getId)}
        strategy={verticalListSortingStrategy}
      >
        {pages.map((page, index) => (
          <SortablePage key={getId(page, index)} id={getId(page, index)}>
            <div className="px-4 py-3 bg-muted/50 border-b flex items-center justify-between gap-3">
              <Input
                value={page.slug}
                onChange={(e) => handleSlugChange(index, e.target.value)}
                className="w-full max-w-sm text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDuplicate(index)}
                >
                  📄
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(index)}
                >
                  🗑️
                </Button>
              </div>
            </div>
            <TemplatePreview
              data={{ pages: [page] }}
              colorScheme={colorScheme}
              onBlockClick={onBlockClick}
            />
          </SortablePage>
        ))}
      </SortableContext>
    </DndContext>
  );
}