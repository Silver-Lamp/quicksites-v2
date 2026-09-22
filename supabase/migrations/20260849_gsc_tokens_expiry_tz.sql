-- 20260849_gsc_tokens_expiry_tz.sql
--
-- `gsc_tokens.expiry` was `timestamp without time zone`, so Postgres returned it zone-less
-- ("2026-09-22T13:21:00.429") and `new Date(...)` in getValidOAuthClient parsed it as LOCAL time.
--
-- ⚠️ ON VERCEL THAT IS HARMLESS AND THAT IS WHY IT SURVIVED: the runtime is UTC, so local == UTC
-- and the comparison is right. Anywhere else it is wrong by the offset — on a UTC-7 laptop an
-- expired token reads as valid for another SEVEN HOURS, so the refresh never fires and every
-- Search Console call returns "Request had invalid authentication credentials". Found 2026-09-22
-- when a harvest that had worked an hour earlier failed on all 68 domains at once.
--
-- The stored values are UTC wall-clock (the writer passed a Date, whose ISO form was truncated on
-- store), so `at time zone 'UTC'` reinterprets them correctly rather than shifting them.

alter table public.gsc_tokens
  alter column expiry type timestamptz using (expiry at time zone 'UTC');
