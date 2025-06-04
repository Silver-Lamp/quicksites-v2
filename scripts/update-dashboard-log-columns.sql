ALTER TABLE dashboard_access_log
ADD COLUMN user_agent text,
ADD COLUMN ip_address text,
ADD COLUMN city text,
ADD COLUMN region text,
ADD COLUMN country text;
