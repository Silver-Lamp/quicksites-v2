alter table support_campaigns
  alter column created_by drop not null;

alter table support_campaigns
  add column if not exists preclaim_token text;
