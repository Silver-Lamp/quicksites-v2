create or replace function queue_screenshot_on_claim()
returns trigger as $$
begin
  if NEW.is_claimed = true then
    insert into screenshot_queue (domain)
    values (NEW.domain)
    on conflict do nothing;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trigger_queue_screenshot on domains;

create trigger trigger_queue_screenshot
after update on domains
for each row
when (OLD.is_claimed is distinct from NEW.is_claimed)
execute procedure queue_screenshot_on_claim();
