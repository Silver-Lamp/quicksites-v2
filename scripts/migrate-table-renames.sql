-- Rename published_sites to public_sites
ALTER TABLE published_sites RENAME TO public_sites;

-- Rename domains to draft_sites
ALTER TABLE domains RENAME TO draft_sites;

-- Optional: rename columns for consistency
-- ALTER TABLE draft_sites RENAME COLUMN owner_id TO user_id;
