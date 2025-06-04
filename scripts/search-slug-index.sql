-- Add a trigram index on slug for fast fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_public_sites_slug_trgm
  ON public_sites USING gin (slug gin_trgm_ops);
