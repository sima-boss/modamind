-- ============================================================
-- ModaMind — Close a live RLS exposure on the original tables
--
-- 001_initial_schema.sql already defines the correct owner-scoped
-- policies for products/product_attributes/outfits/outfit_items/
-- outfit_content, but `enable row level security` was never actually
-- in effect on the live database — every row was readable/writable
-- by anyone holding the public anon key. This migration:
--   1. Backfills the NULL owner_id rows in `products` to the sole
--      existing user (demo@modamind.com) so they don't silently
--      disappear once RLS is enforced.
--   2. Enables RLS on all 5 tables so the existing policies finally
--      take effect.
-- ============================================================

-- 1. BACKFILL — assign orphaned products to the one existing user.
-- Safe because this project currently has exactly one auth.users row.
update public.products
set owner_id = (select id from auth.users order by created_at asc limit 1)
where owner_id is null;

-- 2. ENABLE RLS — the policies already exist (from 001_initial_schema.sql);
-- this is what was missing to make them actually enforced.
alter table public.products enable row level security;
alter table public.product_attributes enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;
alter table public.outfit_content enable row level security;
