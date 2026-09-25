-- ============================================================
-- ModaMind — Usage tracking columns + usage_events log
-- ============================================================

alter table public.subscriptions
  add column outfit_generations_used int not null default 0,
  add column ai_captions_used int not null default 0,
  add column outfit_topup_balance int not null default 0;

create table public.usage_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('outfit_generation', 'ai_caption')),
  created_at  timestamptz not null default now()
);

alter table public.usage_events enable row level security;

create policy "Users can view their own usage events"
  on public.usage_events for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy for authenticated users — only the
-- service-role functions in 010_usage_functions.sql ever write here.
