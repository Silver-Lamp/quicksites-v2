CREATE TABLE IF NOT EXISTS dashboard_layouts (
  role text primary key,
  layout jsonb,
  hidden text[]
);
