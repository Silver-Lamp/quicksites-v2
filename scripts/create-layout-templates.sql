CREATE TABLE IF NOT EXISTS dashboard_layout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  layout jsonb,
  hidden text[],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dashboard_user_layouts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES dashboard_layout_templates(id)
);
