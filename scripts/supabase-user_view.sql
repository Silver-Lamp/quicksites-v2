create or replace view branding_profiles_with_email as
select
  bp.*,
  u.email as owner_email
from branding_profiles bp
left join auth.users u on bp.owner_id = u.id;
