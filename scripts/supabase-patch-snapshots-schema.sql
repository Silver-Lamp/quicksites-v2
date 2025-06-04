-- Drop NOT NULL on `data` column if it's optional
alter table snapshots
alter column data drop not null;

-- Add styling fields if they don't already exist
alter table snapshots
add column if not exists theme text;

alter table snapshots
add column if not exists brand text;

alter table snapshots
add column if not exists color_scheme text;
