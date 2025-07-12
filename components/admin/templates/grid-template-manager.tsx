"use client";

import { useEffect, useState } from "react";
import { Trash2, Download, Upload, Pencil } from "lucide-react";
import type { GridPreset } from "@/types/grid-presets";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import GridThumbnailRenderer from "./grid-thumbnail-renderer";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { useRouter } from "next/navigation";

export default function GridTemplateManager({
  onInsertTemplate,
  showPreview = true,
}: {
  onInsertTemplate?: (preset: GridPreset) => void;
  showPreview?: boolean;
}) {
  const [presets, setPresets] = useState<GridPreset[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const router = useRouter();

  useEffect(() => {
    supabase
      .from("grid_presets")
      .select("*")
      .then(({ data, error }) => {
        if (data) setPresets(data);
        if (error) console.error("Error loading presets:", error.message);
      });
  }, [supabase]);

  const deletePreset = async (name: string) => {
    const { error } = await supabase.from("grid_presets").delete().eq("name", name);
    if (!error) {
      setPresets((prev) => prev.filter((p) => p.name !== name));
    } else {
      alert("Failed to delete: " + error.message);
    }
  };

  const allTags = Array.from(new Set(presets.flatMap((p) => p.tags || [])));
  const visiblePresets = filter
    ? presets.filter((p) => p.tags?.includes(filter))
    : presets;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <button
          onClick={() => setFilter(null)}
          className={`px-2 py-1 rounded ${
            filter === null ? "bg-white/10 text-white" : "hover:bg-white/5"
          }`}
        >
          All
        </button>
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setFilter(tag)}
            className={`px-2 py-1 rounded ${
              filter === tag ? "bg-white/10 text-white" : "hover:bg-white/5"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {visiblePresets.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground text-sm"
          >
            No templates saved.
          </motion.p>
        ) : (
          visiblePresets.map((preset) => (
            <motion.div
              key={preset.name}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border border-white/10 rounded px-3 py-2 space-y-2 bg-muted/20"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-semibold text-white">{preset.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {preset.columns} column{preset.columns !== 1 ? 's' : ''} · {preset.items.length} block{preset.items.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => router.push(`/admin/presets/edit/${preset.id}`)}
                  >
                    <Pencil className="w-4 h-4 text-yellow-400" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deletePreset(preset.name)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>

              {showPreview && <GridThumbnailRenderer preset={preset} onSelect={onInsertTemplate} />}

              {onInsertTemplate && !showPreview && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => onInsertTemplate(preset)}
                  >
                    ➕ Insert into Page
                  </Button>
                </div>
              )}
            </motion.div>
          ))
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2 pt-4">
        {/* Export/Import can be added later with Supabase storage */}

        <Link
          href="/admin/presets"
          className="text-xs text-white/80 hover:text-white underline underline-offset-2 ml-auto"
        >
          Manage All Templates →
        </Link>
      </div>
    </div>
  );
}
