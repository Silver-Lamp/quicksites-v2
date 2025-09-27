// components/admin/templates/truth/types.ts
export type SnapshotInfo = {
    id: string;
    rev: number;
    hash?: string;
    createdAt: string; // ISO
    note?: string;
  };
  
  export type VersionTagInfo = {
    tag: string;
    snapshotId: string;
    notes?: string;
    createdAt?: string;
  };
  
  export type TemplateEvent = {
    id: string;
    type: 'open' | 'autosave' | 'save' | 'snapshot' | 'publish';
    at: string; // ISO
    revBefore?: number;
    revAfter?: number;
    actor?: { id?: string; name?: string; email?: string };
    fieldsTouched?: string[];
    diff?: { added?: number; changed?: number; removed?: number };
    meta?: Record<string, unknown>;
  };
  
  export type InfraState = {
    template: { id: string; rev: number; hash?: string };
    site?: { id: string; slug: string; publishedSnapshotId?: string };
    lastSnapshot?: { id?: string; rev?: number; hash?: string; createdAt?: string };
    cache?: { tags?: string[]; lastRevalidatedAt?: string };
  };
  
  export type TruthTrackerProps = {
    templateId: string;
    infra?: InfraState;
    snapshots?: SnapshotInfo[];
    versions?: VersionTagInfo[];
    events?: TemplateEvent[];
    selectedSnapshotId?: string;
    onCreateSnapshot?: () => void;
    onPublish?: (snapshotId: string) => void;
    onRestore?: (id: string) => void;
    onRefresh?: () => void;
    onViewDiff?: (eventId: string) => void;
    fileRefs?: string[];
    terms?: { term: string; def: string }[];
    readmeSummary?: string;
    adminMeta?: { deprecated_files?: string[] };
    className?: string;
  };
  