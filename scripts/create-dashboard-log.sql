CREATE TABLE IF NOT EXISTS dashboard_access_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email text,
  timestamp timestamptz DEFAULT now()
);
