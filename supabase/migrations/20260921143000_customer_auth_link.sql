-- Allow staff to create customer profiles before a Supabase Auth account exists.
alter table public.clientes add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

do $$ begin
  alter table public.clientes drop constraint clientes_id_fkey;
exception when undefined_object then null;
end $$;

drop policy if exists "clientes_select_own_or_staff" on public.clientes;
create policy "clientes_select_own_or_staff" on public.clientes
for select to authenticated
using (auth_user_id = auth.uid() or id = auth.uid() or public.has_staff_permission('clientes_read'));

drop policy if exists "clientes_insert_self_or_staff" on public.clientes;
create policy "clientes_insert_self_or_staff" on public.clientes
for insert to authenticated
with check (public.has_staff_permission('clientes_write') or auth_user_id = auth.uid() or id = auth.uid());

drop policy if exists "clientes_update_self_or_staff" on public.clientes;
create policy "clientes_update_self_or_staff" on public.clientes
for update to authenticated
using (auth_user_id = auth.uid() or id = auth.uid() or public.has_staff_permission('clientes_write'))
with check (auth_user_id = auth.uid() or id = auth.uid() or public.has_staff_permission('clientes_write'));
