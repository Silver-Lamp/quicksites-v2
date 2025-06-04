ALTER TABLE template_versions
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
