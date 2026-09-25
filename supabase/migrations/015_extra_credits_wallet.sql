-- ============================================================
-- ModaMind — Universal extra-credits wallet (outfits + captions)
--
-- Replaces the outfit-only top-up balance with a single wallet
-- usable for both outfit generations and AI captions. Existing
-- balances migrate automatically via the column rename — no data
-- copy needed. Same "one function, one transaction" / SECURITY
-- DEFINER / service_role-only pattern as the rest of billing.
-- ============================================================

alter table public.subscriptions
  rename column outfit_topup_balance to extra_credits_balance;

alter table public.billing_transactions
  add column credits int;

drop function if exists public.consume_usage_credits(uuid, text, int);
drop function if exists public.refund_usage_credits(uuid, text, int, int);
drop function if exists public.add_outfit_topup(uuid, int, numeric);

-- Monthly allowance first, then the shared extra-credits wallet,
-- for BOTH outfit_generation and ai_caption.
create function public.consume_usage_credits(p_user_id uuid, p_type text, p_count int)
returns table(from_monthly int, from_extra int)
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
  v_from_extra int := 0;
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
    v_from_extra := p_count - v_from_monthly;

    if v_from_extra > 0 and v_sub.extra_credits_balance < v_from_extra then
      raise exception 'limit_reached';
    end if;
  else
    v_from_monthly := p_count;
  end if;

  update public.subscriptions
  set outfit_generations_used = case when p_type = 'outfit_generation' then outfit_generations_used + p_count else outfit_generations_used end,
      ai_captions_used = case when p_type = 'ai_caption' then ai_captions_used + p_count else ai_captions_used end,
      extra_credits_balance = extra_credits_balance - v_from_extra,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.usage_events (user_id, type)
  select p_user_id, p_type from generate_series(1, p_count);

  return query select v_from_monthly, v_from_extra;
end;
$$;

revoke execute on function public.consume_usage_credits(uuid, text, int) from public, anon, authenticated;
grant execute on function public.consume_usage_credits(uuid, text, int) to service_role;


-- Reverses an exact consume_usage_credits() result (used when the AI call
-- fails, or the matcher produces fewer outfits than were reserved). Also
-- deletes the matching number of most-recent usage_events rows, since a
-- refunded action never produced real output and shouldn't show up in
-- Step 5's charts.
create function public.refund_usage_credits(p_user_id uuid, p_type text, p_from_monthly int, p_from_extra int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int := p_from_monthly + p_from_extra;
begin
  if v_total <= 0 then
    return;
  end if;

  update public.subscriptions
  set outfit_generations_used = case when p_type = 'outfit_generation' then greatest(outfit_generations_used - v_total, 0) else outfit_generations_used end,
      ai_captions_used = case when p_type = 'ai_caption' then greatest(ai_captions_used - v_total, 0) else ai_captions_used end,
      extra_credits_balance = extra_credits_balance + p_from_extra,
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


-- Adds a non-expiring extra-credit top-up (spendable on outfits or
-- captions, 1 credit each) and logs the transaction atomically (same
-- "one function, one transaction" pattern as Step 2's checkout/upgrade/
-- downgrade functions).
create function public.add_extra_credits(p_user_id uuid, p_credits int, p_amount_aed numeric)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
begin
  update public.subscriptions
  set extra_credits_balance = extra_credits_balance + p_credits, updated_at = now()
  where user_id = p_user_id
  returning * into v_sub;

  if not found then
    raise exception 'No subscription found for this user';
  end if;

  insert into public.billing_transactions (user_id, type, description, amount_aed, credits)
  values (p_user_id, 'top-up', 'Purchased ' || p_credits || ' extra credits', p_amount_aed, p_credits);

  return v_sub;
end;
$$;

revoke execute on function public.add_extra_credits(uuid, int, numeric) from public, anon, authenticated;
grant execute on function public.add_extra_credits(uuid, int, numeric) to service_role;
