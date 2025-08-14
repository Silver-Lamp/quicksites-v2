import React from "react";
import { BlockAny } from "./_likely-remove_types";
import { getBlockDef, migrateProps } from "./_likely-remove_registry";

export default async function BlockRenderer({ blocks }: { blocks: BlockAny[] }) {
  const sections = await Promise.all(blocks.map(async (b) => {
    const def = getBlockDef(b.type);
    if (!def) {
      return (
        <section key={b.id} data-block-type={b.type} className="my-4 p-3 border rounded-xl bg-amber-50">
          <div className="text-sm">Missing block type: <b>{b.type}</b></div>
        </section>
      );
    }
    const props = migrateProps(def, b.props, b.version);
    const C = def.Component as any;
    const node = await C({ props });
    return (
      <section key={b.id} data-block-type={b.type} data-block-id={b.id} className="my-4">
        {node}
      </section>
    );
  }));
  return <>{sections}</>;
}