-- Give accounts created before the profile trigger a matching profile row.
insert into public.profiles (id, first_name, last_name)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'first_name', ''),
  coalesce(u.raw_user_meta_data ->> 'last_name', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;