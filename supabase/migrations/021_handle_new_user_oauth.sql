-- ============================================================
-- ModaMind — Make handle_new_user OAuth-friendly (Google sign-in)
--
-- The on_auth_user_created trigger already fires for OAuth users. Email
-- signups put full_name/business_name in raw_user_meta_data; Google puts
-- full_name + name and never a business name. So: fall back to `name`,
-- treat empty strings as null, and leave business_name null — the app
-- prompts for it on /complete-profile after the first Google login.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.profiles (id, full_name, business_name)
    values (
      new.id,
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'name'), '')
      ),
      nullif(btrim(new.raw_user_meta_data ->> 'business_name'), '')
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user: failed to create profile for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- Backfill any auth user (e.g. a Google sign-in from before this
-- migration) that is missing a profile row.
insert into public.profiles (id, full_name, business_name)
select
  u.id,
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
  ),
  nullif(btrim(u.raw_user_meta_data ->> 'business_name'), '')
from auth.users u
on conflict (id) do nothing;
