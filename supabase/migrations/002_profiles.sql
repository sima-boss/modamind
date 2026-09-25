-- ============================================================
-- ModaMind — Profiles table + auto-provisioning trigger
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. TABLE
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  business_name text,
  created_at    timestamptz not null default now()
);

-- 2. ROW LEVEL SECURITY
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert/delete policy for regular users: the trigger below runs
-- as security definer and creates the row on their behalf; deletion
-- cascades automatically when the auth.users row is deleted.

-- 3. AUTO-PROVISION PROFILE ON SIGNUP
-- security definer + empty search_path per Supabase hardening guidance;
-- fully-qualified names since search_path is empty. Wrapped in exception
-- handling so a profile-insert failure can never block auth.users signup.
create function public.handle_new_user()
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
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'business_name'
    );
  exception when others then
    raise warning 'handle_new_user: failed to create profile for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. BACKFILL — create profile rows for any users that already exist
-- (e.g. demo@modamind.com), so existing accounts aren't left without a
-- profile row once profile-dependent UI reads it.
insert into public.profiles (id, full_name, business_name)
select
  u.id,
  u.raw_user_meta_data ->> 'full_name',
  u.raw_user_meta_data ->> 'business_name'
from auth.users u
on conflict (id) do nothing;
