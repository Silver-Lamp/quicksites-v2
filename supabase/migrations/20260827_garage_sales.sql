-- 20260827_garage_sales.sql
--
-- Garage sales: pre-printed stickers that a seller sticks on their cardboard sign, and the
-- short-lived sale page behind them.
--
-- The flow this schema is shaped by: an operator prints a sheet of stickers and keeps them in the
-- car. Every sticker carries a unique code and is DORMANT. Someone doing a garage sale gets one,
-- scans it, and activates it in about a minute. A shopper who scans an unclaimed sticker — or the
-- same sticker after the sale is over — gets the directory of sales near them instead.
--
-- Four things here are deliberate.
--
-- 1. **The sticker exists before the seller does.** `garage_sale_stickers` rows are minted in
--    batches with nobody attached, because the physical object is handed to a stranger. This is
--    the same shape as the unclaimed `listing_import` drafts, and it has the same rule: a code is
--    claimable exactly once, and claiming is the only thing that binds it to a person.
--
-- 2. **We never store a payment credential — only a HANDLE.** `payment_handles` holds public
--    usernames (a Venmo @name, a $cashtag), which is all a pay-link needs. The seller's money
--    never routes through us in v1, so there is no account, no KYC, no payout to hold, and
--    nothing here worth stealing. A Connect upgrade later adds a column; it does not change this.
--
-- 3. **The exact address is withheld until the day of the sale.** `address_line` is the precise
--    street address and `address_public_from` is when it may be shown; before that the directory
--    shows `block_label` ("400 block of Elm St"). A garage sale sign on a corner is seen by people
--    driving past it. A searchable index of "there is cash and strangers at this address on
--    Saturday", queryable a week ahead by anyone, is a different object, and the seller putting a
--    sign in their yard has not agreed to the second one. The default protects the seller who
--    never considered the difference; `address_precision` lets one who has considered it opt out.
--
-- 4. **Sales expire, and expiry is data rather than a cron.** `ends_at` is required. The page and
--    the directory both filter on it, so a sale that is over stops being listed without anything
--    having to run. A "short-lived site" whose shortness depends on a scheduled job is a site that
--    outlives its sale every time the job fails.

-- ── Stickers ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.garage_sale_stickers (
  -- The code printed on the sticker. Short and unambiguous — see lib/garageSales/codes.ts for
  -- the alphabet (no O/0/I/1), because this gets read off a sticker by a person and typed into a
  -- phone when a camera won't focus.
  code           text primary key,

  -- Which printed sheet this came from. Lets an operator answer "did the Elm St batch convert?"
  -- without tracking individual stickers.
  batch          text,

  claimed_by     uuid references auth.users(id) on delete set null,
  claimed_at     timestamptz,

  created_at     timestamptz not null default now()
);

create index if not exists garage_sale_stickers_batch_idx on public.garage_sale_stickers (batch);
create index if not exists garage_sale_stickers_unclaimed_idx
  on public.garage_sale_stickers (created_at) where claimed_at is null;

-- ── Sales ───────────────────────────────────────────────────────────────────────────────────
create table if not exists public.garage_sales (
  id                    uuid primary key default gen_random_uuid(),

  -- One live sale per sticker. A sticker is a physical object in one place; letting it address
  -- two sales at once would mean a shopper cannot know which one they are looking at.
  sticker_code          text unique references public.garage_sale_stickers(code) on delete set null,

  owner_id              uuid not null references auth.users(id) on delete cascade,

  title                 text not null,
  description           text,

  -- Precise location. `address_line` is NOT public until address_public_from (see note 3).
  address_line          text,
  block_label           text,
  city                  text,
  state                 text,
  postal_code           text,
  lat                   double precision,
  lng                   double precision,

  -- 'block' (default) reveals address_line only from address_public_from; 'exact' shows it
  -- immediately, which is a choice the seller makes knowingly.
  address_precision     text not null default 'block'
                          check (address_precision in ('block', 'exact')),
  address_public_from   timestamptz,

  starts_at             timestamptz not null,
  ends_at               timestamptz not null,

  -- { venmo: 'handle', cashapp: '$tag', paypal: 'handle' } — public usernames only (note 2).
  payment_handles       jsonb not null default '{}'::jsonb,

  -- Seller can hide the listing without deleting the sale.
  listed                boolean not null default true,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint garage_sales_window check (ends_at > starts_at)
);

create index if not exists garage_sales_window_idx on public.garage_sales (ends_at, starts_at);
create index if not exists garage_sales_geo_idx on public.garage_sales (lat, lng) where listed;
create index if not exists garage_sales_owner_idx on public.garage_sales (owner_id);

-- ── Items ───────────────────────────────────────────────────────────────────────────────────
-- Optional by design: the seller who just wants to ring up "$40 for that whole box" never adds a
-- single row here, and the sale page works fine empty.
create table if not exists public.garage_sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.garage_sales(id) on delete cascade,
  name         text not null,
  price_cents  integer check (price_cents is null or price_cents >= 0),
  image_url    text,
  sold_at      timestamptz,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists garage_sale_items_sale_idx on public.garage_sale_items (sale_id, position);

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
alter table public.garage_sale_stickers enable row level security;
alter table public.garage_sales         enable row level security;
alter table public.garage_sale_items    enable row level security;

-- Stickers: deny-default. Minting is an operator action (service role) and claiming goes through
-- a route that checks the code is unclaimed. Nothing about a sticker is public — the code is the
-- secret, and letting anyone enumerate unclaimed codes would let them claim sales they were never
-- handed a sticker for.
drop policy if exists garage_sale_stickers_no_access on public.garage_sale_stickers;
create policy garage_sale_stickers_no_access on public.garage_sale_stickers
  for all using (false) with check (false);

-- Sales: a LIVE, LISTED sale is public — that is the product. Everything else is owner-only.
-- Note the read policy does not expose address_line by itself; the API projects the address
-- according to address_precision (lib/garageSales/address.ts). RLS decides WHICH ROWS, the
-- projection decides WHICH FIELDS, and conflating those is how the precise address would leak.
drop policy if exists garage_sales_public_read on public.garage_sales;
create policy garage_sales_public_read on public.garage_sales
  for select using (listed and ends_at > now());

drop policy if exists garage_sales_owner_all on public.garage_sales;
create policy garage_sales_owner_all on public.garage_sales
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists garage_sale_items_public_read on public.garage_sale_items;
create policy garage_sale_items_public_read on public.garage_sale_items
  for select using (
    exists (
      select 1 from public.garage_sales s
      where s.id = sale_id and s.listed and s.ends_at > now()
    )
  );

drop policy if exists garage_sale_items_owner_all on public.garage_sale_items;
create policy garage_sale_items_owner_all on public.garage_sale_items
  for all using (
    exists (select 1 from public.garage_sales s where s.id = sale_id and s.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.garage_sales s where s.id = sale_id and s.owner_id = auth.uid())
  );
