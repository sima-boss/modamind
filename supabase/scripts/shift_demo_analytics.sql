-- ============================================================
-- Fashnix — Shift one account's demo analytics forward in time
--
-- Run manually in the Supabase SQL editor. NOT a migration.
--
-- For the ONE account set in the _shift_cfg line below:
--   * The shift is a whole number of days, computed from the latest
--     usage_events row ONLY, so that row lands on yesterday (Asia/Dubai).
--     Time of day is preserved.
--   * usage_events: every row for that user is shifted.
--   * outfits / outfit_content: the same shift is applied to that user's
--     rows (seeded rows can't be told apart from real ones), EXCEPT any
--     row where created_at + shift would be later than now().
--   * subscriptions.*_used counters are NOT touched (billing state).
--
-- Output: the SQL editor shows only the last result, so the script ends
-- with one report: before/after row counts and min/max created_at per
-- table, plus the shift applied. Notices (Messages tab) show rows updated.
--
-- Dry run: replace COMMIT with ROLLBACK. The report then shows only the
-- "before" rows; the Messages tab notices show how many rows would move.
-- ============================================================

drop table if exists _shift_cfg, _shift, _shift_report;

-- >>> Set the account here <<<
create temp table _shift_cfg as
select 'demo@modamind.com'::text as email;

-- Resolve the user and the whole-day shift.
create temp table _shift as
select
  u.id as user_id,
  (
    ((now() at time zone 'Asia/Dubai')::date - 1)
    - (max(e.created_at) at time zone 'Asia/Dubai')::date
  ) * interval '1 day' as shift
from _shift_cfg c
join auth.users u on u.email = c.email
left join public.usage_events e on e.user_id = u.id
group by u.id;

create temp table _shift_report (
  phase text, tbl text, rows bigint, min_created timestamptz, max_created timestamptz
);

-- BEFORE
insert into _shift_report
select '1 before', 'usage_events', count(*), min(created_at), max(created_at)
from public.usage_events where user_id = (select user_id from _shift)
union all
select '1 before', 'outfits', count(*), min(created_at), max(created_at)
from public.outfits where owner_id = (select user_id from _shift)
union all
select '1 before', 'outfit_content', count(*), min(c.created_at), max(c.created_at)
from public.outfit_content c
join public.outfits o on o.id = c.outfit_id
where o.owner_id = (select user_id from _shift);

-- Only the updates below run inside the transaction; the setup above is
-- read-only and lives in session temp tables so the report survives a
-- ROLLBACK.
begin;

do $$
declare
  v_user uuid;
  v_shift interval;
  n int;
begin
  select user_id, shift into v_user, v_shift from _shift;

  if v_user is null then
    raise notice 'Account not found — nothing changed.';
    return;
  end if;
  if v_shift is null or v_shift <= interval '0' then
    raise notice 'Shift is % — no events, or latest event is already yesterday or later; nothing changed.', v_shift;
    return;
  end if;

  update public.usage_events
  set created_at = created_at + v_shift
  where user_id = v_user;
  get diagnostics n = row_count;
  raise notice 'usage_events shifted: %', n;

  update public.outfit_content c
  set created_at = c.created_at + v_shift
  from public.outfits o
  where o.id = c.outfit_id
    and o.owner_id = v_user
    and c.created_at + v_shift <= now();
  get diagnostics n = row_count;
  raise notice 'outfit_content shifted: %', n;

  update public.outfits
  set created_at = created_at + v_shift
  where owner_id = v_user
    and created_at + v_shift <= now();
  get diagnostics n = row_count;
  raise notice 'outfits shifted: %', n;
end
$$;

-- AFTER
insert into _shift_report
select '2 after', 'usage_events', count(*), min(created_at), max(created_at)
from public.usage_events where user_id = (select user_id from _shift)
union all
select '2 after', 'outfits', count(*), min(created_at), max(created_at)
from public.outfits where owner_id = (select user_id from _shift)
union all
select '2 after', 'outfit_content', count(*), min(c.created_at), max(c.created_at)
from public.outfit_content c
join public.outfits o on o.id = c.outfit_id
where o.owner_id = (select user_id from _shift);

commit;  -- use ROLLBACK instead for a dry run

-- Report (no rows at all = email not found).
select c.email, s.shift, r.phase, r.tbl, r.rows, r.min_created, r.max_created
from _shift_cfg c
join _shift s on true
join _shift_report r on true
order by r.tbl, r.phase;
