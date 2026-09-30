-- ============================================================
-- ModaMind — Brand kit (Premium only)
--
-- Lets a Premium user apply their own logo + brand colors to exported
-- outfit cards instead of the default Fashnix branding strip.
-- ============================================================

alter table public.profiles
  add column brand_logo_url      text,
  add column brand_primary_color text,
  add column brand_secondary_color text;
