-- 20260815_client_collabs.sql
--
-- Client collaboration: one page where a client sees the layout options built for them, asks
-- questions, answers ours, and eventually decides — visible to both the client and the operator.
--
-- ⚠️ THE CLIENT HAS NO ACCOUNT, AND SHOULD NOT NEED ONE. Amy is a client, not an operator. Making
-- her sign up to look at her own site options adds a login wall to the one moment where friction
-- is most expensive — the moment she is deciding whether to proceed at all. Access is a signed,
-- revocable token in a link (lib/collab/collabToken.ts), the same shape as the site-claim token.
--
-- ⚠️ EVERY MESSAGE CARRIES ITS AUTHOR ROLE, AND THAT IS LOAD-BEARING. A collaboration thread that
-- cannot distinguish "the operator said this" from "the client said this" from "this was drafted
-- for the operator" is a thread nobody can rely on later, when the question is what was actually
-- agreed. `author_role` is NOT NULL and constrained; there is deliberately no default, so a
-- caller cannot omit it and have it silently become 'operator'.
--
-- Deny-default RLS, service-role only. Reads go through routes that check either an operator
-- session or a valid collab token — never RLS alone, because the client is unauthenticated by
-- design and there is no session for a policy to key on.

create table if not exists public.client_collabs (
  id            uuid primary key default gen_random_uuid(),

  -- Shown to both sides, so the thread is identifiable at a glance.
  title         text not null,

  -- Who it is for. Email is how the link is delivered; name is how they are addressed.
  client_name   text,
  client_email  text,

  -- Who owns it. Null tolerated so a collab can be created by a script before an operator claims it.
  operator_id   uuid,

  -- The layout options under discussion, in presentation order.
  template_ids  uuid[] not null default '{}',

  -- draft → shared → decided → archived. Free text rather than an enum so the flow can change
  -- without a migration; the app owns the vocabulary.
  status        text not null default 'draft',

  -- Which option the client chose. Null until they choose — and "null" must never be rendered
  -- as "no preference", only as "not decided yet".
  decided_template_id uuid references public.templates(id) on delete set null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.collab_messages (
  id            uuid primary key default gen_random_uuid(),
  collab_id     uuid not null references public.client_collabs(id) on delete cascade,

  -- ⚠️ No default. See the header: a message whose author is ambiguous is worse than no message.
  author_role   text not null check (author_role in ('operator', 'client')),
  author_name   text,

  -- 'message' | 'question' | 'answer' — a question is a message that expects a reply, and an
  -- answer points back at the question it answers, so a long thread stays readable.
  kind          text not null default 'message' check (kind in ('message', 'question', 'answer')),
  answers_id    uuid references public.collab_messages(id) on delete set null,

  body          text not null,

  -- Optional: a message about one specific layout rather than the whole set.
  template_id   uuid references public.templates(id) on delete set null,

  created_at    timestamptz not null default now()
);

create index if not exists collab_messages_thread_idx
  on public.collab_messages (collab_id, created_at);

create index if not exists client_collabs_operator_idx
  on public.client_collabs (operator_id, created_at desc);

alter table public.client_collabs enable row level security;
alter table public.collab_messages enable row level security;

drop policy if exists client_collabs_deny_all on public.client_collabs;
create policy client_collabs_deny_all on public.client_collabs for all using (false) with check (false);

drop policy if exists collab_messages_deny_all on public.collab_messages;
create policy collab_messages_deny_all on public.collab_messages for all using (false) with check (false);

comment on table public.client_collabs is
  'One collaboration thread per client engagement. Client access is via a signed token, not an account.';
comment on column public.collab_messages.author_role is
  'operator | client. No default by design — an unattributed message in a decision thread is worse than none.';
