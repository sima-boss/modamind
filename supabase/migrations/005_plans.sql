-- ============================================================
-- ModaMind — Plan catalog (Basic / Standard / Premium)
-- ============================================================

create table public.plans (
  id                        text primary key,
  name                      text not null,
  price_aed                 numeric not null,
  is_most_popular           boolean not null default false,
  outfit_generations_limit  int,              -- null = unlimited
  products_limit            int,              -- null = unlimited
  ai_captions_limit         int,              -- null = unlimited
  languages                 text[] not null default array['en'],
  social_formats            text[],           -- e.g. {instagram,tiktok}; null = none
  analytics_level           text not null default 'basic' check (analytics_level in ('basic', 'full')),
  export_formats            text[],           -- e.g. {pdf,csv}; null = none
  has_brand_kit             boolean not null default false,
  has_priority_generation   boolean not null default false,
  team_members_limit        int not null,
  sort_order                int not null,
  created_at                timestamptz not null default now()
);

alter table public.plans enable row level security;

-- Pricing catalog is not sensitive; anyone (including anon) can read it.
-- No insert/update/delete policy — the catalog is migration-managed only.
create policy "Anyone can view plans"
  on public.plans for select
  using (true);

insert into public.plans
  (id, name, price_aed, is_most_popular, outfit_generations_limit, products_limit,
   ai_captions_limit, languages, social_formats, analytics_level, export_formats,
   has_brand_kit, has_priority_generation, team_members_limit, sort_order)
values
  ('basic', 'Basic', 149, false, 300, 100, 50,
   array['en'], null, 'basic', null, false, false, 1, 1),
  ('standard', 'Standard', 349, true, 1000, 500, 300,
   array['en', 'ar'], array['instagram', 'tiktok'], 'full', null, false, false, 3, 2),
  ('premium', 'Premium', 799, false, 3000, null, null,
   array['en', 'ar'], array['instagram', 'tiktok'], 'full', array['pdf', 'csv'], true, true, 10, 3);
