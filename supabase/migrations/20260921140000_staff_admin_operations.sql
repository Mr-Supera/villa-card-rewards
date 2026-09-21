-- Villa Card Rewards: staff/admin operations and configurable loyalty tiers
create table if not exists public.niveis_fidelidade (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem integer not null default 1,
  desconto_percentual numeric(5,2) not null default 0 check (desconto_percentual >= 0 and desconto_percentual <= 100),
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.niveis_fidelidade (nome, ordem, desconto_percentual, descricao)
values
  ('bronze', 1, 0, 'Nível inicial'),
  ('prata', 2, 5, 'Benefícios de nível prata'),
  ('ouro', 3, 10, 'Benefícios de nível ouro'),
  ('platina', 4, 15, 'Benefícios de nível platina')
on conflict (nome) do nothing;

alter table public.niveis_fidelidade enable row level security;
drop policy if exists "niveis_select_authenticated" on public.niveis_fidelidade;
create policy "niveis_select_authenticated" on public.niveis_fidelidade
for select to authenticated using (true);
drop policy if exists "niveis_manage_staff" on public.niveis_fidelidade;
create policy "niveis_manage_staff" on public.niveis_fidelidade
for all to authenticated
using (public.has_staff_permission('niveis_write'))
with check (public.has_staff_permission('niveis_write'));

create or replace function public.registar_recarga(
  _cliente_id uuid,
  _valor numeric,
  _descricao text default 'Recarga ao balcão'
)
returns public.transacoes
language plpgsql
security definer
set search_path = public
as $$
declare r public.transacoes;
begin
  if not public.has_staff_permission('transacoes_write') then raise exception 'Sem permissão para registar transações'; end if;
  if _valor <= 0 then raise exception 'O valor deve ser maior que zero'; end if;
  update public.clientes set saldo_atual = saldo_atual + _valor where id = _cliente_id;
  if not found then raise exception 'Cliente não encontrado'; end if;
  insert into public.transacoes(cliente_id,tipo,valor,saldo_apos,descricao,staff_id)
  select c.id,'recarga',_valor,c.saldo_atual,_descricao,auth.uid() from public.clientes c where c.id=_cliente_id
  returning * into r;
  return r;
end $$;

create or replace function public.registar_consumo(
  _cliente_id uuid,
  _valor_bruto numeric,
  _descricao text default 'Consumo'
)
returns public.transacoes
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.transacoes;
  v_desconto numeric := 0;
  v_final numeric;
begin
  if not public.has_staff_permission('transacoes_write') then raise exception 'Sem permissão para registar transações'; end if;
  if _valor_bruto <= 0 then raise exception 'O valor deve ser maior que zero'; end if;
  select coalesce(n.desconto_percentual,0) into v_desconto
  from public.clientes c
  left join public.niveis_fidelidade n on lower(n.nome)=lower(c.tier)
  where c.id=_cliente_id;
  v_final := round(_valor_bruto * (1 - v_desconto/100), 2);
  update public.clientes set saldo_atual = saldo_atual - v_final
  where id=_cliente_id and saldo_atual >= v_final;
  if not found then raise exception 'Saldo insuficiente ou cliente não encontrado'; end if;
  insert into public.transacoes(cliente_id,tipo,valor,saldo_apos,descricao,staff_id)
  select c.id,'consumo',v_final,c.saldo_atual,
    case when v_desconto > 0 then _descricao || ' · desconto ' || v_desconto || '%' else _descricao end,
    auth.uid()
  from public.clientes c where c.id=_cliente_id
  returning * into r;
  return r;
end $$;

grant execute on function public.registar_recarga(uuid,numeric,text) to authenticated;
grant execute on function public.registar_consumo(uuid,numeric,text) to authenticated;
