-- ============================================================
-- ModaMind — Rename "priority generation" to "bulk generation"
--
-- Step 3 seeded a has_priority_generation flag that no UI ever read.
-- Step 4 replaces it with the real feature it was meant to gate: the
-- ability to generate more than one outfit per request (up to 10),
-- Premium only.
-- ============================================================

alter table public.plans rename column has_priority_generation to has_bulk_generation;
