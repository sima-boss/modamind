-- ============================================================
-- ModaMind — Initial Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. TABLES
-- ----------------------------------------------------------

-- Products table
create table public.products (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid(),
  name       text not null,
  category   text not null,
  price      numeric not null,
  image_url  text,
  created_at timestamptz not null default now()
);

-- AI-extracted attributes for each product
create table public.product_attributes (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete cascade,
  dominant_colors jsonb,
  pattern         text,
  formality       text,
  style_tags      jsonb,
  season          text,
  clothing_type   text,
  raw_ai_json     jsonb,
  created_at      timestamptz not null default now()
);

-- Outfits (collections of products)
create table public.outfits (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid(),
  theme_name  text,
  title       text,
  created_at  timestamptz not null default now()
);

-- Junction table: which products belong to an outfit
create table public.outfit_items (
  id         uuid primary key default gen_random_uuid(),
  outfit_id  uuid not null references public.outfits(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  role       text  -- e.g. 'top', 'bottom', 'shoes', 'accessory'
);

-- AI-generated content for an outfit
create table public.outfit_content (
  id             uuid primary key default gen_random_uuid(),
  outfit_id      uuid not null references public.outfits(id) on delete cascade,
  description    text,
  styling_tips   text,
  social_caption text,
  created_at     timestamptz not null default now()
);

-- 2. INDEXES
-- ----------------------------------------------------------

create index idx_products_owner        on public.products (owner_id);
create index idx_product_attrs_product on public.product_attributes (product_id);
create index idx_outfits_owner         on public.outfits (owner_id);
create index idx_outfit_items_outfit   on public.outfit_items (outfit_id);
create index idx_outfit_content_outfit on public.outfit_content (outfit_id);

-- 3. ROW LEVEL SECURITY
-- ----------------------------------------------------------
-- owner_id columns on `products` and `outfits` scope data to
-- the authenticated user. Child tables (product_attributes,
-- outfit_items, outfit_content) inherit access through their
-- foreign-key joins — an RLS policy on the parent is enough
-- because the child rows are only reachable via parent rows
-- the user already owns.

-- products
alter table public.products enable row level security;

create policy "Users can view their own products"
  on public.products for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own products"
  on public.products for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own products"
  on public.products for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete their own products"
  on public.products for delete
  using (auth.uid() = owner_id);

-- product_attributes (scoped through product ownership)
alter table public.product_attributes enable row level security;

create policy "Users can manage attributes of their products"
  on public.product_attributes for all
  using (
    exists (
      select 1 from public.products
      where products.id = product_attributes.product_id
        and products.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products
      where products.id = product_attributes.product_id
        and products.owner_id = auth.uid()
    )
  );

-- outfits
alter table public.outfits enable row level security;

create policy "Users can view their own outfits"
  on public.outfits for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own outfits"
  on public.outfits for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own outfits"
  on public.outfits for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete their own outfits"
  on public.outfits for delete
  using (auth.uid() = owner_id);

-- outfit_items (scoped through outfit ownership)
alter table public.outfit_items enable row level security;

create policy "Users can manage items of their outfits"
  on public.outfit_items for all
  using (
    exists (
      select 1 from public.outfits
      where outfits.id = outfit_items.outfit_id
        and outfits.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.outfits
      where outfits.id = outfit_items.outfit_id
        and outfits.owner_id = auth.uid()
    )
  );

-- outfit_content (scoped through outfit ownership)
alter table public.outfit_content enable row level security;

create policy "Users can manage content of their outfits"
  on public.outfit_content for all
  using (
    exists (
      select 1 from public.outfits
      where outfits.id = outfit_content.outfit_id
        and outfits.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.outfits
      where outfits.id = outfit_content.outfit_id
        and outfits.owner_id = auth.uid()
    )
  );

-- 4. STORAGE BUCKET (optional — for product images)
-- ----------------------------------------------------------
-- Uncomment and run separately if you want image uploads:
--
-- insert into storage.buckets (id, name, public)
-- values ('product-images', 'product-images', true);
--
-- create policy "Authenticated users can upload product images"
--   on storage.objects for insert
--   with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
--
-- create policy "Anyone can view product images"
--   on storage.objects for select
--   using (bucket_id = 'product-images');
