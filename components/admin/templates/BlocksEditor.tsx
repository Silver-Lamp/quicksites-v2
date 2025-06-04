// BlocksEditor.tsx (dynamic presets by industry)
import { useState } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import { Button } from '@/components/admin/ui/button";
import BlockSidebar from "./BlockSidebar";
import type { Block } from "@/admin/types/blocks";
import type { BlocksEditorProps } from "@/admin/types/blocks";
import { normalizeBlock } from '@/admin/types/blocks';

type SortableBlockProps = {
  block: Block;
  index: number;
  onEdit: (index: number) => void;
};
function SortableBlock({ block, index, onEdit }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ 
    id: block.id || `block-${index}` // Ensure id is never undefined
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between gap-2 border rounded p-3 bg-white/5">
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 cursor-move text-muted-foreground" {...attributes} {...listeners} />
        <span className="text-sm font-medium text-white">{block.type}</span>
      </div>
      <Button size="sm" variant="ghost" onClick={() => onEdit(index)}>
        <Pencil className="w-4 h-4" />
      </Button>
    </div>
  );
}

type PresetBlock = Record<string, any>;

type PresetMap = Record<string, Record<string, PresetBlock>>;

const industryPresets: PresetMap = {
  towing: {
    hero: {
      type: "hero",
      headline: "24/7 Emergency Towing",
      subheadline: "Serving your city with pride.",
      cta_text: "Call Now",
      cta_link: "/contact"
    },
    services: {
      type: "services",
      items: ["Roadside Assistance", "Jump Starts", "Flatbed Towing"]
    },
    testimonial: {
      type: "testimonial",
      quote: "Fast and professional. 5 stars!",
      attribution: "Alex T., Customer"
    }
  },
  dentistry: {
    hero: {
      type: "hero",
      headline: "Gentle Dentistry, Modern Tools",
      subheadline: "Accepting new patients today.",
      cta_text: "Book Appointment",
      cta_link: "/book"
    },
    testimonial: {
      type: "testimonial",
      quote: "They made me smile again!",
      attribution: "Sara M., Patient"
    },
    services: {
      type: "services",
      items: ["Cleanings", "Whitening", "Fillings"]
    }
  },
  default: {
    hero: {
      type: "hero",
      headline: "Welcome to Our Website",
      subheadline: "We're glad you're here.",
      cta_text: "Learn More",
      cta_link: "/about"
    },
    cta: {
      type: "cta",
      label: "Contact Us",
      link: "/contact"
    }
  }
};

export const BlocksEditor = ({ blocks, onChange, industry = "default" }: BlocksEditorProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const ensureIds = (blocks: Block[]) =>
    blocks.map((block) => ({ ...block, id: block.id || crypto.randomUUID() }));

  const safeBlocks: (Block & { id: string })[] = ensureIds(blocks);

  const handleUpdate = (index: number, updatedBlock: Block) => {
    const updatedBlocks = [...safeBlocks];
    updatedBlocks[index] = normalizeBlock(updatedBlock);
    onChange(updatedBlocks);
  };

  const handleAddPreset = (type: string) => {
    const preset = (industryPresets[industry.toLowerCase()] || industryPresets.default)[type];
    const newBlock = normalizeBlock({ ...preset, type: type as Block['type'] });
    onChange([...safeBlocks, newBlock]);
  };

  const handleDragEnd = ({ active, over }: any) => {
    if (active.id !== over.id) {
      const oldIndex = safeBlocks.findIndex(b => b.id === active.id);
      const newIndex = safeBlocks.findIndex(b => b.id === over.id);
      const reordered = arrayMove(safeBlocks, oldIndex, newIndex);
      onChange(reordered);
    }
  };

  const availablePresets = industryPresets[industry.toLowerCase()] || industryPresets.default;

  return (
    <div className="space-y-4">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={safeBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
          {safeBlocks.map((block, index) => (
            <SortableBlock key={block.id || `${block.type}-${index}`} block={block} index={index} onEdit={setSelectedIndex} />
          ))}
        </SortableContext>
      </DndContext>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.keys(availablePresets).map((type) => (
          <Button key={type} variant="outline" size="sm" onClick={() => handleAddPreset(type)}>
            + {type.charAt(0).toUpperCase() + type.slice(1)}
          </Button>
        ))}
      </div>

      {selectedIndex !== null && (
        <BlockSidebar
          block={safeBlocks[selectedIndex]}
          onChange={(updated) => handleUpdate(selectedIndex, updated)}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </div>
  );
};
