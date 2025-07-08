"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SortableGridBlock from "@/components/admin/templates/sortable-grid-block";
import { normalizeBlock } from "@/types/blocks";
import type { Block } from "@/types/blocks";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";

export default function AdminPresetsNewPage() {
  const [name, setName] = useState("");
  const [columns, setColumns] = useState(2);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  const handleSave = async () => {
    if (!name.trim()) return alert("Name is required");

    const { error } = await supabase.from("grid_presets").insert({
      name,
      columns,
      items: blocks.map(normalizeBlock),
    });

    if (error) {
      alert("Failed to save preset: " + error.message);
      return;
    }

    router.push("/admin/presets");
  };

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">New Grid Preset</h1>

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
        <Button onClick={handleSave}>Save Preset</Button>
      </div>

      <SortableGridBlock
        items={blocks}
        columns={columns}
        onChange={setBlocks}
        onInsert={(index) => {
          const fallback: Block = {
            type: "text",
            content: { value: "New block..." },
            _id: crypto.randomUUID(),
          };
          const updated = [...blocks];
          updated.splice(index, 0, fallback);
          setBlocks(updated);
        }}
      />
    </div>
  );
}
