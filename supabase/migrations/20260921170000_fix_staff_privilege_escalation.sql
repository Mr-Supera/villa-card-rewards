-- SECURITY FIX: staff privilege escalation prevention
-- Only an existing admin may create, update or delete staff rows.
-- is_admin/is_staff are SECURITY DEFINER helpers that read staff directly and do not
-- rely on INSERT/UPDATE permissions, preventing circular privilege escalation.

create or replace function public.is_admin(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff s
    where s.id = _user_id
      and (
        lower(coalesce(s.role, '')) = 'admin'
        or lower(coalesce(s.cargo, '')) in ('admin', 'administrador')
      )
  );
$$;

create or replace function public.is_staff(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff s
    where s.id = _user_id
  );
$$;

revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_staff(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;

-- Remove the old broad policy, which allowed any permission-bearing staff row
-- to mutate staff membership/roles.
drop policy if exists "staff_manage_authorized" on public.staff;

drop policy if exists "staff_insert_admin_only" on public.staff;
create policy "staff_insert_admin_only"
on public.staff
for insert
to authenticated
with check (public.is_admin(auth.uid()));

drop policy if exists "staff_update_admin_only" on public.staff;
create policy "staff_update_admin_only"
on public.staff
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "staff_delete_admin_only" on public.staff;
create policy "staff_delete_admin_only"
on public.staff
for delete
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "staff_select_self_or_admin" on public.staff;
create policy "staff_select_self_or_admin"
on public.staff
for select
to authenticated
using (id = auth.uid() or public.is_admin(auth.uid()));

-- Regression scenario (must be REJECTED):
-- Given authenticated user U with no row in staff, this statement must fail RLS:
--   insert into public.staff(id,nome,cargo,email) values (auth.uid(),'Attacker','admin','attacker@example.com');
-- Expected: new row violates row-level security policy for table "staff".
--
-- The policy is based on the EXISTING staff row for auth.uid(); inserting that row
-- cannot make is_admin(auth.uid()) become true because the INSERT is evaluated first.
