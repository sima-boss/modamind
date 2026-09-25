-- ============================================================
-- ModaMind — Atomic billing state-change functions
--
-- Each function does its subscription update + billing_transactions
-- insert in one call (one implicit transaction). SECURITY DEFINER with
-- an empty search_path and fully-qualified names; EXECUTE is revoked
-- from public/anon/authenticated and granted only to service_role, so
-- these can only ever be invoked from server code using the service
-- role key, never directly from the browser. p_user_id always comes
-- from the caller's own auth.getUser() result server-side.
-- ============================================================

create or replace function public.checkout_subscription(p_user_id uuid, p_plan_id text)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_sub public.subscriptions%rowtype;
begin
  select * into v_plan from public.plans where id = p_plan_id;
  if not found then
    raise exception 'Invalid plan_id: %', p_plan_id;
  end if;

  if exists (select 1 from public.subscriptions where user_id = p_user_id) then
    raise exception 'A subscription already exists for this user';
  end if;

  insert into public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
  values (p_user_id, p_plan_id, 'active', now(), now() + interval '1 month')
  returning * into v_sub;

  insert into public.billing_transactions (user_id, type, description, amount_aed)
  values (p_user_id, 'subscription', 'Subscribed to ' || v_plan.name || ' plan', v_plan.price_aed);

  return v_sub;
end;
$$;

revoke execute on function public.checkout_subscription(uuid, text) from public, anon, authenticated;
grant execute on function public.checkout_subscription(uuid, text) to service_role;


create or replace function public.upgrade_subscription(p_user_id uuid, p_new_plan_id text)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_current_plan public.plans%rowtype;
  v_new_plan public.plans%rowtype;
  v_diff numeric;
begin
  select * into v_sub from public.subscriptions where user_id = p_user_id;
  if not found then
    raise exception 'No subscription found for this user';
  end if;

  select * into v_current_plan from public.plans where id = v_sub.plan_id;
  select * into v_new_plan from public.plans where id = p_new_plan_id;
  if not found then
    raise exception 'Invalid plan_id: %', p_new_plan_id;
  end if;

  if v_new_plan.price_aed <= v_current_plan.price_aed then
    raise exception 'Target plan is not an upgrade from the current plan';
  end if;

  v_diff := v_new_plan.price_aed - v_current_plan.price_aed;

  update public.subscriptions
  set plan_id = p_new_plan_id, pending_plan_id = null, updated_at = now()
  where user_id = p_user_id
  returning * into v_sub;

  insert into public.billing_transactions (user_id, type, description, amount_aed)
  values (p_user_id, 'upgrade', 'Upgraded from ' || v_current_plan.name || ' to ' || v_new_plan.name, v_diff);

  return v_sub;
end;
$$;

revoke execute on function public.upgrade_subscription(uuid, text) from public, anon, authenticated;
grant execute on function public.upgrade_subscription(uuid, text) to service_role;


create or replace function public.downgrade_subscription(p_user_id uuid, p_new_plan_id text)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_current_plan public.plans%rowtype;
  v_new_plan public.plans%rowtype;
begin
  select * into v_sub from public.subscriptions where user_id = p_user_id;
  if not found then
    raise exception 'No subscription found for this user';
  end if;

  if v_sub.pending_plan_id is not null then
    raise exception 'A plan change is already pending';
  end if;

  select * into v_current_plan from public.plans where id = v_sub.plan_id;
  select * into v_new_plan from public.plans where id = p_new_plan_id;
  if not found then
    raise exception 'Invalid plan_id: %', p_new_plan_id;
  end if;

  if v_new_plan.price_aed >= v_current_plan.price_aed then
    raise exception 'Target plan is not a downgrade from the current plan';
  end if;

  update public.subscriptions
  set pending_plan_id = p_new_plan_id, updated_at = now()
  where user_id = p_user_id
  returning * into v_sub;

  return v_sub;
end;
$$;

revoke execute on function public.downgrade_subscription(uuid, text) from public, anon, authenticated;
grant execute on function public.downgrade_subscription(uuid, text) to service_role;


create or replace function public.cancel_pending_downgrade(p_user_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
begin
  update public.subscriptions
  set pending_plan_id = null, updated_at = now()
  where user_id = p_user_id
  returning * into v_sub;

  if not found then
    raise exception 'No subscription found for this user';
  end if;

  return v_sub;
end;
$$;

revoke execute on function public.cancel_pending_downgrade(uuid) from public, anon, authenticated;
grant execute on function public.cancel_pending_downgrade(uuid) to service_role;


create or replace function public.simulate_renewal(p_user_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_plan public.plans%rowtype;
begin
  select * into v_sub from public.subscriptions where user_id = p_user_id;
  if not found then
    raise exception 'No subscription found for this user';
  end if;

  update public.subscriptions
  set plan_id = coalesce(pending_plan_id, plan_id),
      pending_plan_id = null,
      current_period_start = now(),
      current_period_end = now() + interval '1 month',
      updated_at = now()
  where user_id = p_user_id
  returning * into v_sub;

  select * into v_plan from public.plans where id = v_sub.plan_id;

  insert into public.billing_transactions (user_id, type, description, amount_aed)
  values (p_user_id, 'renewal', 'Renewed ' || v_plan.name || ' plan', v_plan.price_aed);

  return v_sub;
end;
$$;

revoke execute on function public.simulate_renewal(uuid) from public, anon, authenticated;
grant execute on function public.simulate_renewal(uuid) to service_role;
