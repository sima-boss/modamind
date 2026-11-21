-- ============================================================
-- Fashnix — Date-range analytics functions
--
-- New range-based versions of the 019 analytics functions. Every
-- function takes p_from / p_to (inclusive calendar days in Asia/Dubai).
-- Same security pattern as 019: SECURITY INVOKER, so RLS on
-- usage_events / outfits / outfit_content scopes results to the caller,
-- plus explicit auth.uid() filters as belt-and-braces.
--
-- The 019 functions are intentionally left untouched so the currently
-- deployed app keeps working until the new code ships.
-- ============================================================

-- Shared range validation: both dates present, from <= to, to not in the
-- future (Dubai), at most 366 days. Raises invalid_parameter_value.
create or replace function public.analytics_assert_range(p_from date, p_to date)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_from is null or p_to is null then
    raise exception 'p_from and p_to are required' using errcode = '22023';
  end if;
  if p_from > p_to then
    raise exception 'p_from must be on or before p_to' using errcode = '22023';
  end if;
  if p_to > (now() at time zone 'Asia/Dubai')::date then
    raise exception 'p_to cannot be in the future' using errcode = '22023';
  end if;
  if (p_to - p_from + 1) > 366 then
    raise exception 'range cannot exceed 366 days' using errcode = '22023';
  end if;
end;
$$;

-- Per-day generations in the range, zero-filled so the chart has no gaps.
create or replace function public.analytics_range_daily_usage(p_from date, p_to date)
returns table(day date, outfits int, captions int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.analytics_assert_range(p_from, p_to);

  return query
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as d
  ),
  events as (
    select (e.created_at at time zone 'Asia/Dubai')::date as d, e.type
    from public.usage_events e
    where e.user_id = auth.uid()
      and e.created_at >= (p_from::timestamp at time zone 'Asia/Dubai')
      and e.created_at <  ((p_to + 1)::timestamp at time zone 'Asia/Dubai')
  )
  select
    days.d,
    (count(*) filter (where events.type = 'outfit_generation'))::int,
    (count(*) filter (where events.type = 'ai_caption'))::int
  from days
  left join events on events.d = days.d
  group by days.d
  order by days.d;
end;
$$;

-- Headline numbers for the range, plus the previous period of equal length.
create or replace function public.analytics_range_summary(p_from date, p_to date)
returns table(
  outfits int,
  captions int,
  outfits_prev int,
  captions_prev int,
  saved_outfits int,
  active_days int,
  busiest_day date,
  busiest_day_count int
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_len int := p_to - p_from + 1;
  v_start timestamptz := (p_from::timestamp at time zone 'Asia/Dubai');
  v_end   timestamptz := ((p_to + 1)::timestamp at time zone 'Asia/Dubai');
  v_prev_start timestamptz := ((p_from - v_len)::timestamp at time zone 'Asia/Dubai');
begin
  perform public.analytics_assert_range(p_from, p_to);

  return query
  with ev as (
    select e.type, e.created_at, (e.created_at at time zone 'Asia/Dubai')::date as d
    from public.usage_events e
    where e.user_id = auth.uid()
      and e.created_at >= v_prev_start
      and e.created_at <  v_end
  ),
  cur as (
    select * from ev where ev.created_at >= v_start
  ),
  prev as (
    select * from ev where ev.created_at < v_start
  ),
  busiest as (
    select cur.d, count(*)::int as n
    from cur
    where cur.type = 'outfit_generation'
    group by cur.d
    order by n desc, cur.d desc
    limit 1
  )
  select
    (select count(*) from cur where cur.type = 'outfit_generation')::int,
    (select count(*) from cur where cur.type = 'ai_caption')::int,
    (select count(*) from prev where prev.type = 'outfit_generation')::int,
    (select count(*) from prev where prev.type = 'ai_caption')::int,
    (select count(*) from public.outfits o
       where o.owner_id = auth.uid()
         and o.created_at >= v_start and o.created_at < v_end)::int,
    (select count(distinct cur.d) from cur)::int,
    (select busiest.d from busiest),
    coalesce((select busiest.n from busiest), 0);
end;
$$;

-- Saved outfits by occasion/theme, created in the range.
create or replace function public.analytics_range_outfits_by_theme(p_from date, p_to date)
returns table(theme text, total int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.analytics_assert_range(p_from, p_to);

  return query
  select coalesce(nullif(o.theme_name, ''), 'Uncategorised') as theme, count(*)::int
  from public.outfits o
  where o.owner_id = auth.uid()
    and o.created_at >= (p_from::timestamp at time zone 'Asia/Dubai')
    and o.created_at <  ((p_to + 1)::timestamp at time zone 'Asia/Dubai')
  group by 1
  order by 2 desc, 1;
end;
$$;

-- Saved captions by language and format, generated in the range.
create or replace function public.analytics_range_captions_breakdown(p_from date, p_to date)
returns table(language text, format text, total int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.analytics_assert_range(p_from, p_to);

  return query
  select c.language, c.format, count(*)::int
  from public.outfit_content c
  join public.outfits o on o.id = c.outfit_id
  where o.owner_id = auth.uid()
    and c.social_caption is not null
    and c.created_at >= (p_from::timestamp at time zone 'Asia/Dubai')
    and c.created_at <  ((p_to + 1)::timestamp at time zone 'Asia/Dubai')
  group by 1, 2
  order by 3 desc;
end;
$$;

revoke all on function public.analytics_assert_range(date, date) from public, anon;
revoke all on function public.analytics_range_daily_usage(date, date) from public, anon;
revoke all on function public.analytics_range_summary(date, date) from public, anon;
revoke all on function public.analytics_range_outfits_by_theme(date, date) from public, anon;
revoke all on function public.analytics_range_captions_breakdown(date, date) from public, anon;

grant execute on function public.analytics_assert_range(date, date) to authenticated;
grant execute on function public.analytics_range_daily_usage(date, date) to authenticated;
grant execute on function public.analytics_range_summary(date, date) to authenticated;
grant execute on function public.analytics_range_outfits_by_theme(date, date) to authenticated;
grant execute on function public.analytics_range_captions_breakdown(date, date) to authenticated;
