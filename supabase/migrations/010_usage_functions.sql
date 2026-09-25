-- ============================================================
-- ModaMind — Atomic usage credit functions
-- ============================================================

-- Atomically checks + deducts one metered action (monthly allowance first,
-- then top-up balance for outfit generations only — captions have no
-- top-up mechanism per spec). Row-locks the subscription so concurrent
-- spam-clicks serialize instead of racing past the limit. Always logs
-- p_count usage_events rows for Step 5's charts, and always increments
-- the "used" counter (even on unlimited plans) purely for tracking —
-- the limit check itself is skipped when the plan's limit is null.
create or replace function public.consume_usage_credits(p_user_id uuid, p_type text, p_count int)
returns table(from_monthly int, from_topup int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_plan public.plans%rowtype;
  v_limit int;
  v_used int;
  v_remaining_monthly int;
  v_from_monthly int := 0;
  v_from_topup int := 0;
begin
  if p_type not in ('outfit_generation', 'ai_caption') then
    raise exception 'Invalid usage type: %', p_type;
  end if;
  if p_count <= 0 then
    raise exception 'p_count must be positive';
  end if;

  select * into v_sub from public.subscriptions where user_id = p_user_id for update;
  if not found then
    raise exception 'No subscription found for this user';
  end if;

  select * into v_plan from public.plans where id = v_sub.plan_id;

  if p_type = 'outfit_generation' then
    v_limit := v_plan.outfit_generations_limit;
    v_used := v_sub.outfit_generations_used;
  else
    v_limit := v_plan.ai_captions_limit;
    v_used := v_sub.ai_captions_used;
  end if;

  if v_limit is not null then
    v_remaining_monthly := greatest(v_limit - v_used, 0);
    v_from_monthly := least(v_remaining_monthly, p_count);
    v_from_topup := p_count - v_from_monthly;

    if v_from_topup > 0 then
      if p_type <> 'outfit_generation' or v_sub.outfit_topup_balance < v_from_topup then
        raise exception 'limit_reached';
      end if;
    end if;
  else
    v_from_monthly := p_count;
  end if;

  update public.subscriptions
  set outfit_generations_used = case when p_type = 'outfit_generation' then outfit_generations_used + p_count else outfit_generations_used end,
      ai_captions_used = case when p_type = 'ai_caption' then ai_captions_used + p_count else ai_captions_used end,
      outfit_topup_balance = case when p_type = 'outfit_generation' then outfit_topup_balance - v_from_topup else outfit_topup_balance end,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.usage_events (user_id, type)
  select p_user_id, p_type from generate_series(1, p_count);

  return query select v_from_monthly, v_from_topup;
end;
$$;

revoke execute on function public.consume_usage_credits(uuid, text, int) from public, anon, authenticated;
grant execute on function public.consume_usage_credits(uuid, text, int) to service_role;


-- Reverses an exact consume_usage_credits() result (used when the AI call
-- fails, or the matcher produces fewer outfits than were reserved). Also
-- deletes the matching number of most-recent usage_events rows, since a
-- refunded action never produced real output and shouldn't show up in
-- Step 5's charts.
create or replace function public.refund_usage_credits(p_user_id uuid, p_type text, p_from_monthly int, p_from_topup int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int := p_from_monthly + p_from_topup;
begin
  if v_total <= 0 then
    return;
  end if;

  update public.subscriptions
  set outfit_generations_used = case when p_type = 'outfit_generation' then greatest(outfit_generations_used - v_total, 0) else outfit_generations_used end,
      ai_captions_used = case when p_type = 'ai_caption' then greatest(ai_captions_used - v_total, 0) else ai_captions_used end,
      outfit_topup_balance = case when p_type = 'outfit_generation' then outfit_topup_balance + p_from_topup else outfit_topup_balance end,
      updated_at = now()
  where user_id = p_user_id;

  delete from public.usage_events
  where id in (
    select id from public.usage_events
    where user_id = p_user_id and type = p_type
    order by created_at desc
    limit v_total
  );
end;
$$;

revoke execute on function public.refund_usage_credits(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.refund_usage_credits(uuid, text, int, int) to service_role;


-- Adds a non-expiring outfit-generation top-up and logs the transaction
-- atomically (same "one function, one transaction" pattern as Step 2's
-- checkout/upgrade/downgrade functions).
create or replace function public.add_outfit_topup(p_user_id uuid, p_outfits int, p_amount_aed numeric)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
begin
  update public.subscriptions
  set outfit_topup_balance = outfit_topup_balance + p_outfits, updated_at = now()
  where user_id = p_user_id
  returning * into v_sub;

  if not found then
    raise exception 'No subscription found for this user';
  end if;

  insert into public.billing_transactions (user_id, type, description, amount_aed)
  values (p_user_id, 'top-up', 'Purchased ' || p_outfits || ' outfit credits', p_amount_aed);

  return v_sub;
end;
$$;

revoke execute on function public.add_outfit_topup(uuid, int, numeric) from public, anon, authenticated;
grant execute on function public.add_outfit_topup(uuid, int, numeric) to service_role;


-- Demo tool: sets the CALLER's own usage to limit - 2 on every metered
-- type that has a numeric limit (no-op on unlimited metrics). p_user_id
-- always comes from the server's own auth.getUser() result.
create or replace function public.debug_set_usage_near_limit(p_user_id uuid)
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
  select * into v_plan from public.plans where id = v_sub.plan_id;

  update public.subscriptions
  set outfit_generations_used = case when v_plan.outfit_generations_limit is not null
        then greatest(v_plan.outfit_generations_limit - 2, 0) else outfit_generations_used end,
      ai_captions_used = case when v_plan.ai_captions_limit is not null
        then greatest(v_plan.ai_captions_limit - 2, 0) else ai_captions_used end,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_sub;

  return v_sub;
end;
$$;

revoke execute on function public.debug_set_usage_near_limit(uuid) from public, anon, authenticated;
grant execute on function public.debug_set_usage_near_limit(uuid) to service_role;
