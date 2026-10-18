-- Creative versions + review feedback (owner, 2026-10-17: "a versioning interface with feedback
-- buttons on each version — thumbs up, down, comments that Amy and Daryle can leave for me, and I
-- can add replies — to show all of them, I'll run some more in the meantime").
--
-- A `project` groups takes for one client surface (bhard). Every take the owner renders is a
-- row; exactly which one the live site plays is read from the template, never from here — the
-- `is_live` flag is a mirror set by the set-live route so the review page can label it.
-- Reviewers (Amy, Daryle) have no accounts: they arrive on a signed link that names them, and the
-- feedback row records the key the link carried. Service-role only; the public surface is the
-- signed route.
create table if not exists public.creative_versions (
  id uuid primary key default gen_random_uuid(),
  project text not null,
  track text not null,                    -- e.g. 'get-it-done', 'bhard-jingle', 'pool-spot'
  version int not null,
  kind text not null check (kind in ('audio', 'video')),
  title text not null,
  url text not null,                      -- public storage URL (videos bucket)
  content_type text,
  duration_seconds numeric,
  transcript text,
  transcript_status text not null default 'pending' check (transcript_status in ('pending', 'done', 'failed', 'skipped')),
  notes text,                             -- what changed in this take, in the owner's words
  is_live boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (project, track, version)
);
create index if not exists creative_versions_project_idx on public.creative_versions (project, track, version desc);

create table if not exists public.creative_feedback (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.creative_versions (id) on delete cascade,
  author_key text not null,               -- 'amy' | 'daryle' | 'owner' …: the key the signed link carried
  author_name text not null,
  vote text check (vote in ('up', 'down')),
  body text,
  parent_id uuid references public.creative_feedback (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists creative_feedback_version_idx on public.creative_feedback (version_id, created_at);
-- One standing vote per reviewer per version (a vote row has no body and no parent).
create unique index if not exists creative_feedback_one_vote
  on public.creative_feedback (version_id, author_key) where vote is not null and body is null and parent_id is null;

alter table public.creative_versions enable row level security;
alter table public.creative_feedback enable row level security;
-- Deny-default: no policies. Service role only.
