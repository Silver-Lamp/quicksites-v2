CREATE TABLE IF NOT EXISTS dashboard_layout_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  layout jsonb NOT NULL,
  hidden text[],
  created_at timestamptz DEFAULT now()
);

-- Optional: store who saved it
-- ALTER TABLE dashboard_layout_versions ADD COLUMN saved_by uuid;
