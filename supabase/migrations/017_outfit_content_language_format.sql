-- ============================================================
-- ModaMind — Track which language/format a saved caption was generated as
--
-- Basic gets English + generic caption only. Standard+ can pick Arabic
-- (Gulf dialect) and Instagram/TikTok formats. Persisting the choice lets
-- the UI re-render the right label after a page reload, and lets
-- regeneration switch between them.
-- ============================================================

alter table public.outfit_content
  add column language text not null default 'en' check (language in ('en', 'ar')),
  add column format   text not null default 'generic' check (format in ('generic', 'instagram', 'tiktok'));
