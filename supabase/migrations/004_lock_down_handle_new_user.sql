-- handle_new_user() is a trigger function (returns trigger) and can only
-- ever be invoked by Postgres as part of the on_auth_user_created trigger —
-- calling it directly always errors. But being SECURITY DEFINER in the
-- public schema still exposes it as a callable RPC endpoint
-- (/rest/v1/rpc/handle_new_user) to anon/authenticated roles per Supabase's
-- linter. Revoke direct-call privilege; trigger firing is unaffected since
-- that doesn't go through role-based EXECUTE checks.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
