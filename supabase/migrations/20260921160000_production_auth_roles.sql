-- Finalize production auth/RLS shape for Villa Card Rewards.
alter table public.staff add column if not exists role text not null default 'staff'
  check (lower(role) in ('admin','staff'));

update public.staff
set role = case when lower(coalesce(cargo,'')) in ('admin','administrador') then 'admin' else 'staff' end
where role is null or role not in ('admin','staff');

create index if not exists idx_staff_role on public.staff(role);

create or replace function public.has_staff_permission(permission_name text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.staff s
    where s.id=auth.uid()
      and (
        lower(s.role)='admin'
        or lower(coalesce(s.cargo,'')) in ('admin','administrador')
        or coalesce((s.permissoes ->> permission_name)::boolean,false)
        or coalesce((s.permissoes ->> 'admin')::boolean,false)
      )
  );
$$;

-- No public INSERT/UPDATE/DELETE policies exist for any application table.
-- Authenticated customer reads are limited by auth.uid(); staff/admin access uses has_staff_permission().
-- Public email sign-up must be disabled in Supabase Auth dashboard; this is intentionally not
-- implemented as a SQL migration because Auth provider settings are managed outside Postgres.

-- There is intentionally NO auth.users -> profile trigger. Customer profiles are created transactionally
-- by the admin-create-customer Edge Function so Auth user creation cannot create an orphaned profile.
