-- ============================================================
-- ModaMind — Give demo@modamind.com realistic current-period usage
-- ============================================================

update public.subscriptions
set outfit_generations_used = 1240
where user_id = (select id from auth.users where email = 'demo@modamind.com');
