-- Document the authentication policy for deployment: public signup must remain disabled.
-- Supabase Auth setting "Enable email signup" must be OFF in the project Auth configuration.
-- This cannot be safely toggled by a SQL migration; the administrative Edge Function is the only
-- application path that creates customer Auth users and uses SUPABASE_SERVICE_ROLE_KEY server-side.
alter table public.clientes enable row level security;
drop policy if exists "clientes_auth_link_own" on public.clientes;
create policy "clientes_auth_link_own" on public.clientes for select to authenticated using (auth_user_id=auth.uid() or id=auth.uid() or public.has_staff_permission('clientes_read'));
