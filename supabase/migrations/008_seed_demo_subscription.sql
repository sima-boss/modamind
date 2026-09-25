-- ============================================================
-- ModaMind — Seed demo@modamind.com with Premium + realistic history
-- ============================================================

insert into public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
select id, 'premium', 'active', now() - interval '15 days', now() + interval '15 days'
from auth.users where email = 'demo@modamind.com'
on conflict (user_id) do nothing;

insert into public.billing_transactions (user_id, type, description, amount_aed, created_at)
select id, 'subscription', 'Subscribed to Standard plan', 349, now() - interval '75 days'
from auth.users where email = 'demo@modamind.com'
union all
select id, 'renewal', 'Renewed Standard plan', 349, now() - interval '45 days'
from auth.users where email = 'demo@modamind.com'
union all
select id, 'upgrade', 'Upgraded from Standard to Premium', 450, now() - interval '15 days'
from auth.users where email = 'demo@modamind.com';
