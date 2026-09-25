-- ============================================================
-- ModaMind — simulate_renewal also resets monthly usage
--
-- Redefines the Step 2 function (same signature) to zero out
-- outfit_generations_used/ai_captions_used on each simulated renewal.
-- outfit_topup_balance is deliberately left untouched — top-up credits
-- do not expire at renewal.
-- ============================================================

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
      outfit_generations_used = 0,
      ai_captions_used = 0,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_sub;

  select * into v_plan from public.plans where id = v_sub.plan_id;

  insert into public.billing_transactions (user_id, type, description, amount_aed)
  values (p_user_id, 'renewal', 'Renewed ' || v_plan.name || ' plan', v_plan.price_aed);

  return v_sub;
end;
$$;
