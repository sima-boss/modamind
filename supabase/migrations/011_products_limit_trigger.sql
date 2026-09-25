-- ============================================================
-- ModaMind — Enforce the plan's total products limit at the DB level
-- ============================================================

create or replace function public.check_products_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int;
  v_count int;
begin
  select p.products_limit into v_limit
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = new.owner_id;

  if v_limit is not null then
    select count(*) into v_count from public.products where owner_id = new.owner_id;
    if v_count >= v_limit then
      raise exception 'You have reached your plan''s limit of % products. Upgrade your plan to add more.', v_limit;
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_products_limit
  before insert on public.products
  for each row execute function public.check_products_limit();
