-- ============================================================
-- ModaMind — Analytics dashboard queries (Step 5)
--
-- All functions are SECURITY INVOKER, so the existing RLS policies on
-- usage_events / outfits / outfit_content / products scope every result
-- to the caller. The explicit auth.uid() filters are belt-and-braces.
-- Days are bucketed in Asia/Dubai so "today" matches the user's clock.
-- Whether a caller may *see* the full-analytics charts is decided in the
-- app (plan.analytics_level) before these are called.
-- ============================================================

-- Per-day generations, zero-filled so the chart has no gaps.
create or replace function public.analytics_daily_usage(p_days int default 30)
returns table(day date, outfits int, captions int)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select (now() at time zone 'Asia/Dubai')::date as today
  ),
  days as (
    select generate_series(
      (select today from bounds) - (greatest(p_days, 1) - 1),
      (select today from bounds),
      interval '1 day'
    )::date as day
  ),
  events as (
    select (created_at at time zone 'Asia/Dubai')::date as day, type
    from public.usage_events
    where user_id = auth.uid()
  )
  select
    d.day,
    count(*) filter (where e.type = 'outfit_generation')::int,
    count(*) filter (where e.type = 'ai_caption')::int
  from days d
  left join events e on e.day = d.day
  group by d.day
  order by d.day;
$$;

-- Headline numbers: lifetime totals plus last-30 vs previous-30 windows.
create or replace function public.analytics_summary()
returns table(
  total_outfit_generations int,
  total_captions int,
  products int,
  saved_outfits int,
  outfits_last_30 int,
  outfits_prev_30 int,
  captions_last_30 int,
  captions_prev_30 int,
  active_days_last_30 int,
  busiest_day date,
  busiest_day_count int
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ev as (
    select type, created_at, (created_at at time zone 'Asia/Dubai')::date as day
    from public.usage_events
    where user_id = auth.uid()
  ),
  busiest as (
    select day, count(*)::int as n
    from ev
    where type = 'outfit_generation'
    group by day
    order by n desc, day desc
    limit 1
  )
  select
    (select count(*) from ev where type = 'outfit_generation')::int,
    (select count(*) from ev where type = 'ai_caption')::int,
    (select count(*) from public.products where owner_id = auth.uid())::int,
    (select count(*) from public.outfits where owner_id = auth.uid())::int,
    (select count(*) from ev where type = 'outfit_generation'
       and created_at >= now() - interval '30 days')::int,
    (select count(*) from ev where type = 'outfit_generation'
       and created_at >= now() - interval '60 days'
       and created_at <  now() - interval '30 days')::int,
    (select count(*) from ev where type = 'ai_caption'
       and created_at >= now() - interval '30 days')::int,
    (select count(*) from ev where type = 'ai_caption'
       and created_at >= now() - interval '60 days'
       and created_at <  now() - interval '30 days')::int,
    (select count(distinct day) from ev
       where created_at >= now() - interval '30 days')::int,
    (select day from busiest),
    coalesce((select n from busiest), 0);
$$;

-- Saved outfits by occasion/theme.
create or replace function public.analytics_outfits_by_theme()
returns table(theme text, total int)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(nullif(theme_name, ''), 'Uncategorised') as theme, count(*)::int
  from public.outfits
  where owner_id = auth.uid()
  group by 1
  order by 2 desc, 1;
$$;

-- Saved captions by language and format.
create or replace function public.analytics_captions_breakdown()
returns table(language text, format text, total int)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.language, c.format, count(*)::int
  from public.outfit_content c
  join public.outfits o on o.id = c.outfit_id
  where o.owner_id = auth.uid()
    and c.social_caption is not null
  group by 1, 2
  order by 3 desc;
$$;

-- Catalogue mix.
create or replace function public.analytics_products_by_category()
returns table(category text, total int)
language sql
stable
security invoker
set search_path = ''
as $$
  select category, count(*)::int
  from public.products
  where owner_id = auth.uid()
  group by 1
  order by 2 desc, 1;
$$;

revoke all on function public.analytics_daily_usage(int) from public, anon;
revoke all on function public.analytics_summary() from public, anon;
revoke all on function public.analytics_outfits_by_theme() from public, anon;
revoke all on function public.analytics_captions_breakdown() from public, anon;
revoke all on function public.analytics_products_by_category() from public, anon;

grant execute on function public.analytics_daily_usage(int) to authenticated;
grant execute on function public.analytics_summary() to authenticated;
grant execute on function public.analytics_outfits_by_theme() to authenticated;
grant execute on function public.analytics_captions_breakdown() to authenticated;
grant execute on function public.analytics_products_by_category() to authenticated;
