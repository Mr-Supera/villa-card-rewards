-- Villa Card Rewards — Supabase schema
-- Creates application tables, relationships, indexes and RLS policies.
-- Authentication is based on auth.uid(); staff rows must use the same UUID as auth.users.id.

create extension if not exists pgcrypto;

create type public.card_status as enum ('ativo', 'bloqueado', 'perdido');
create type public.transaction_type as enum ('recarga', 'consumo', 'desconto');

create table if not exists public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  cargo text not null,
  permissoes jsonb not null default '{}'::jsonb,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  contacto text,
  email text unique,
  data_registo timestamptz not null default now(),
  cartao_nfc_id uuid,
  saldo_atual numeric(12,2) not null default 0 check (saldo_atual >= 0),
  tier text not null default 'bronze'
    check (lower(tier) in ('bronze','prata','ouro','platina'))
);

create table if not exists public.cartoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  codigo_nfc text not null unique,
  estado public.card_status not null default 'ativo',
  data_emissao timestamptz not null default now()
);

alter table public.clientes
  add constraint clientes_cartao_nfc_fk
  foreign key (cartao_nfc_id) references public.cartoes(id) on delete set null;

create table if not exists public.vantagens (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  tier_minimo text not null default 'bronze'
    check (lower(tier_minimo) in ('bronze','prata','ouro','platina')),
  tipo_desconto text not null,
  valor_desconto numeric(12,2) not null check (valor_desconto >= 0)
);

create table if not exists public.transacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  tipo public.transaction_type not null,
  valor numeric(12,2) not null check (valor >= 0),
  saldo_apos numeric(12,2) not null check (saldo_apos >= 0),
  descricao text,
  staff_id uuid references public.staff(id) on delete set null,
  "timestamp" timestamptz not null default now()
);

create index if not exists idx_cartoes_cliente_id on public.cartoes(cliente_id);
create index if not exists idx_transacoes_cliente_id_timestamp on public.transacoes(cliente_id, "timestamp" desc);
create index if not exists idx_transacoes_staff_id on public.transacoes(staff_id);
create index if not exists idx_vantagens_tier_minimo on public.vantagens(tier_minimo);

alter table public.staff enable row level security;
alter table public.clientes enable row level security;
alter table public.cartoes enable row level security;
alter table public.transacoes enable row level security;
alter table public.vantagens enable row level security;

-- Helper: staff/admin authorization is controlled by the permissoes JSON.
create or replace function public.has_staff_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff s
    where s.id = auth.uid()
      and (
        lower(coalesce(s.cargo, '')) in ('admin', 'administrador')
        or coalesce((s.permissoes ->> permission_name)::boolean, false)
        or coalesce((s.permissoes ->> 'admin')::boolean, false)
      )
  );
$$;

-- STAFF
drop policy if exists "staff_select_self_or_authorized" on public.staff;
create policy "staff_select_self_or_authorized"
on public.staff for select to authenticated
using (id = auth.uid() or public.has_staff_permission('staff_read'));

drop policy if exists "staff_manage_authorized" on public.staff;
create policy "staff_manage_authorized"
on public.staff for all to authenticated
using (public.has_staff_permission('staff_manage'))
with check (public.has_staff_permission('staff_manage'));

-- CLIENTES: customers see only their own row; authorized staff/admin can access broadly.
drop policy if exists "clientes_select_own_or_staff" on public.clientes;
create policy "clientes_select_own_or_staff"
on public.clientes for select to authenticated
using (id = auth.uid() or public.has_staff_permission('clientes_read'));

drop policy if exists "clientes_insert_self_or_staff" on public.clientes;
create policy "clientes_insert_self_or_staff"
on public.clientes for insert to authenticated
with check (id = auth.uid() or public.has_staff_permission('clientes_write'));

drop policy if exists "clientes_update_self_or_staff" on public.clientes;
create policy "clientes_update_self_or_staff"
on public.clientes for update to authenticated
using (id = auth.uid() or public.has_staff_permission('clientes_write'))
with check (id = auth.uid() or public.has_staff_permission('clientes_write'));

drop policy if exists "clientes_delete_staff" on public.clientes;
create policy "clientes_delete_staff"
on public.clientes for delete to authenticated
using (public.has_staff_permission('clientes_delete'));

-- CARDS
drop policy if exists "cartoes_select_own_or_staff" on public.cartoes;
create policy "cartoes_select_own_or_staff"
on public.cartoes for select to authenticated
using (cliente_id = auth.uid() or public.has_staff_permission('cartoes_read'));

drop policy if exists "cartoes_insert_staff" on public.cartoes;
create policy "cartoes_insert_staff"
on public.cartoes for insert to authenticated
with check (cliente_id = auth.uid() or public.has_staff_permission('cartoes_write'));

drop policy if exists "cartoes_update_staff" on public.cartoes;
create policy "cartoes_update_staff"
on public.cartoes for update to authenticated
using (cliente_id = auth.uid() or public.has_staff_permission('cartoes_write'))
with check (cliente_id = auth.uid() or public.has_staff_permission('cartoes_write'));

drop policy if exists "cartoes_delete_staff" on public.cartoes;
create policy "cartoes_delete_staff"
on public.cartoes for delete to authenticated
using (public.has_staff_permission('cartoes_delete'));

-- TRANSACTIONS: clients can read their own history; only authorized staff can create/change transactions.
drop policy if exists "transacoes_select_own_or_staff" on public.transacoes;
create policy "transacoes_select_own_or_staff"
on public.transacoes for select to authenticated
using (cliente_id = auth.uid() or public.has_staff_permission('transacoes_read'));

drop policy if exists "transacoes_insert_staff" on public.transacoes;
create policy "transacoes_insert_staff"
on public.transacoes for insert to authenticated
with check (
  public.has_staff_permission('transacoes_write')
  and staff_id = auth.uid()
);

drop policy if exists "transacoes_update_staff" on public.transacoes;
create policy "transacoes_update_staff"
on public.transacoes for update to authenticated
using (public.has_staff_permission('transacoes_write'))
with check (public.has_staff_permission('transacoes_write'));

drop policy if exists "transacoes_delete_admin" on public.transacoes;
create policy "transacoes_delete_admin"
on public.transacoes for delete to authenticated
using (public.has_staff_permission('transacoes_delete'));

-- ADVANTAGES: customers may read advantages; only authorized staff can manage them.
drop policy if exists "vantagens_select_authenticated" on public.vantagens;
create policy "vantagens_select_authenticated"
on public.vantagens for select to authenticated
using (true);

drop policy if exists "vantagens_manage_staff" on public.vantagens;
create policy "vantagens_manage_staff"
on public.vantagens for all to authenticated
using (public.has_staff_permission('vantagens_write'))
with check (public.has_staff_permission('vantagens_write'));

grant execute on function public.has_staff_permission(text) to authenticated;
