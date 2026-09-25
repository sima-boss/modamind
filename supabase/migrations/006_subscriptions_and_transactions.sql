-- ============================================================
-- ModaMind — Subscriptions + billing transactions
-- ============================================================

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users(id) on delete cascade,
  plan_id                text not null references public.plans(id),
  status                 text not null default 'active' check (status in ('active', 'canceled')),
  current_period_start   timestamptz not null default now(),
  current_period_end     timestamptz not null,
  pending_plan_id        text references public.plans(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can view their own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy for authenticated users: plan changes only
-- happen through server routes using the service role key (never from the
-- browser), per the requirement that users can't change plans directly.

create table public.billing_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null check (type in ('subscription', 'upgrade', 'downgrade', 'renewal', 'top-up')),
  description  text not null,
  amount_aed   numeric not null,
  created_at   timestamptz not null default now()
);

alter table public.billing_transactions enable row level security;

create policy "Users can view their own transactions"
  on public.billing_transactions for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy for authenticated users — service role only.
