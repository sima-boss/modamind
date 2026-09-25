-- check_products_limit() is a trigger function (returns trigger) and can
-- only ever be invoked by Postgres as part of the enforce_products_limit
-- trigger — calling it directly always errors. Revoke direct-call
-- privilege anyway per the same hardening applied to handle_new_user()
-- in migration 004.
revoke execute on function public.check_products_limit() from public, anon, authenticated;
