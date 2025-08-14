import { BlockAny, BlockDef } from "./_likely-remove_types";

const registry = new Map<string, BlockDef<any>>();

export function registerBlock(def: BlockDef<any>) {
  registry.set(def.type, def);
}

export function getBlockDef(type: string): BlockDef<any> | undefined {
  return registry.get(type);
}

export function listBlocks() { return Array.from(registry.keys()); }

export function migrateProps(def: BlockDef<any>, props: any, fromVersion: number) {
  if (def.migrate && fromVersion < def.version) return def.migrate(props, fromVersion);
  return props;
}