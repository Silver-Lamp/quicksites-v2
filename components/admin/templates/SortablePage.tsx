// SortablePage.tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export const SortablePage = ({ page }: { page: any }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <GripVertical className="w-4 h-4 cursor-move text-muted-foreground" {...attributes} {...listeners} />
      <div className="font-semibold">{page.slug}</div>
    </div>
  );
};
