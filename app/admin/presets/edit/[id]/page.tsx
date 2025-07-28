// app/admin/presets/edit/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SortableGridBlock from "@/components/admin/templates/sortable-grid-block";
import { normalizeBlock } from "@/types/blocks";
import type { Block } from "@/types/blocks";
import { supabase } from "@/lib/supabaseClient";
import TemplatePreview from "@/components/admin/templates/template-preview";
import { defaultGridPresets } from "@/types/grid-presets";
import GridThumbnailRenderer from "@/components/admin/templates/grid-thumbnail-renderer";
import { createDefaultBlock } from '@/lib/createDefaultBlock';

export default function AdminPresetsEditPage() {
  const { id } = useParams();
  const router = useRouter();

  const [name, setName] = useState("");
  const [columns, setColumns] = useState(2);
  const [blocks, setBlocks] = useState<Block[]>([]);
  
  useEffect(() => {
    if (!id || typeof id !== "string") return;
    supabase
      .from("grid_presets")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (data) {
          setName(data.name);
          setColumns(data.columns);
          setBlocks(data.items || []);
        }
        if (error) console.error("Failed to load preset:", error.message);
      });
  }, [id]);

  const handleUpdate = async () => {
    if (!name.trim() || typeof id !== "string") return;
    const { error } = await supabase
      .from("grid_presets")
      .update({ name, columns, items: blocks.map(normalizeBlock) })
      .eq("id", id);
    if (!error) {
      router.push("/admin/presets");
    } else {
      alert("Failed to update preset: " + error.message);
    }
  };

  const handleDuplicate = async () => {
    const { error } = await supabase.from("grid_presets").insert({
      name: `${name} (copy)`,
      columns,
      items: blocks.map(normalizeBlock),
    });
    if (!error) router.push("/admin/presets");
    else alert("Failed to duplicate: " + error.message);
  };

  const handleInsertBlock = (index: number, type: string) => {
    const newBlock = createDefaultBlock(type as Block['type']);
    const updated = [...blocks];
    updated.splice(index, 0, newBlock);
    setBlocks(updated);
  };

//   const handleInsertBlock = (index: number, type: string) => {
//     let newBlock: Block;

//     if (type === "grid") {
//       newBlock = {
//         type: "grid",
//         _id: crypto.randomUUID(),
//         content: {
//           columns: 2,
//           items: [
//             { type: "text", content: { value: "Item 1" }, _id: crypto.randomUUID() },
//             { type: "text", content: { value: "Item 2" }, _id: crypto.randomUUID() },
//           ],
//         },
//       };
//     } else {
//       newBlock = {
//         type: type as Block['type'],
//         _id: crypto.randomUUID(),
//         content: {
//             value: `New ${type} block`,
//         },
//       };
//     }

//     const updated = [...blocks];
//     updated.splice(index, 0, newBlock);
//     setBlocks(updated);
//   };

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">Edit Grid Preset</h1>

      <div className="flex gap-4 items-center">
        <Input
          placeholder="Preset Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          value={columns}
          onChange={(e) => setColumns(Number(e.target.value))}
          className="rounded bg-muted px-2 py-1 text-white text-sm"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n} Column{n !== 1 ? "s" : ""}
            </option>
          ))}
        </select>
        <Button onClick={handleUpdate}>Update Preset</Button>
        <Button variant="ghost" onClick={handleDuplicate}>
          Duplicate Preset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {defaultGridPresets.map((preset) => (
          <button
            key={preset.name}
            className="rounded border border-white/10 hover:border-white/30 p-2 text-left text-white text-sm"
            onClick={() => {
              setBlocks((prev) => [...prev, ...preset.items.map(normalizeBlock)]);
            }}
          >
            <div className="font-medium mb-1">{preset.name}</div>
            <GridThumbnailRenderer preset={preset} />
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <SortableGridBlock
          items={blocks}
          columns={columns}
          onChange={setBlocks}
          onInsert={(index) => handleInsertBlock(index, 'text')}
        />

        <div className="bg-white/5 rounded p-4 border border-white/10">
          <h3 className="text-sm text-white font-semibold mb-2">Live Preview</h3>
          <TemplatePreview
            data={{ pages: [{ id: id as string, title: name, slug: "preview", content_blocks: blocks }] }}
            colorScheme="blue"
            onBlockClick={(block) => {
              console.log('block: ', block);
            }}
            showJsonFallback={true}
            mode="dark"
          />
        </div>
      </div>
    </div>
  );
}
