alter table published_sites
add column if not exists language text default 'en';
