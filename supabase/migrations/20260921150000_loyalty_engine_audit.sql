-- Villa Card Rewards: automatic loyalty tiers and fully auditable transactions
alter table public.clientes add column if not exists saldo_acumulado_historico numeric(14,2) not null default 0;
alter table public.clientes add column if not exists visitas_total integer not null default 0;
alter table public.transacoes add column if not exists saldo_antes numeric(14,2);
alter table public.transacoes add column if not exists desconto_percentual numeric(5,2) not null default 0;
alter table public.transacoes add column if not exists valor_bruto numeric(14,2);
alter table public.transacoes add column if not exists tier_antes text;
alter table public.transacoes add column if not exists tier_depois text;
alter table public.transacoes add column if not exists tier_promovido boolean not null default false;

create or replace function public.calcular_tier_cliente(_cliente_id uuid)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare v_tier text;
begin
  select coalesce(
    (select n.nome from public.niveis_fidelidade n
     where n.ativo=true
       and (coalesce(c.saldo_acumulado_historico,0) >= case lower(n.nome)
          when 'platina' then 100000
          when 'ouro' then 50000
          when 'prata' then 20000
          else 0 end)
     order by n.ordem desc limit 1),
    'bronze'
  ) into v_tier
  from public.clientes c where c.id=_cliente_id;
  return v_tier;
end $$;

create or replace function public.registar_recarga(
  _cliente_id uuid, _valor numeric, _descricao text default 'Recarga ao balcão'
)
returns public.transacoes
language plpgsql security definer set search_path=public
as $$
declare r public.transacoes; v_antes numeric; v_depois numeric; v_tier_antes text; v_tier_depois text;
begin
  if not public.has_staff_permission('transacoes_write') then raise exception 'Sem permissão para registar transações'; end if;
  if _valor<=0 then raise exception 'O valor deve ser maior que zero'; end if;
  select saldo_atual,tier into v_antes,v_tier_antes from public.clientes where id=_cliente_id for update;
  if not found then raise exception 'Cliente não encontrado'; end if;
  update public.clientes set saldo_atual=saldo_atual+_valor, saldo_acumulado_historico=saldo_acumulado_historico+_valor where id=_cliente_id returning saldo_atual into v_depois;
  v_tier_depois=public.calcular_tier_cliente(_cliente_id);
  update public.clientes set tier=v_tier_depois where id=_cliente_id;
  insert into public.transacoes(cliente_id,tipo,valor,valor_bruto,desconto_percentual,saldo_antes,saldo_apos,descricao,staff_id,tier_antes,tier_depois,tier_promovido)
  values(_cliente_id,'recarga',_valor,_valor,0,v_antes,v_depois,_descricao,auth.uid(),v_tier_antes,v_tier_depois,v_tier_depois<>v_tier_antes)
  returning * into r;
  return r;
end $$;

create or replace function public.registar_consumo(
  _cliente_id uuid, _valor_bruto numeric, _descricao text default 'Consumo'
)
returns public.transacoes
language plpgsql security definer set search_path=public
as $$
declare r public.transacoes; v_antes numeric; v_final numeric; v_desc numeric; v_tier text; v_tier_depois text; v_visitas integer;
begin
  if not public.has_staff_permission('transacoes_write') then raise exception 'Sem permissão para registar transações'; end if;
  if _valor_bruto<=0 then raise exception 'O valor deve ser maior que zero'; end if;
  select saldo_atual,tier,visitas_total into v_antes,v_tier,v_visitas from public.clientes where id=_cliente_id for update;
  if not found then raise exception 'Cliente não encontrado'; end if;
  select coalesce(n.desconto_percentual,0) into v_desc from public.niveis_fidelidade n where lower(n.nome)=lower(v_tier) and n.ativo=true;
  v_desc=coalesce(v_desc,0);
  v_final=round(_valor_bruto*(1-v_desc/100),2);
  if v_antes<v_final then raise exception 'Saldo insuficiente'; end if;
  update public.clientes set saldo_atual=saldo_atual-v_final,visitas_total=coalesce(visitas_total,0)+1 where id=_cliente_id;
  v_tier_depois=public.calcular_tier_cliente(_cliente_id);
  update public.clientes set tier=v_tier_depois where id=_cliente_id;
  insert into public.transacoes(cliente_id,tipo,valor,valor_bruto,desconto_percentual,saldo_antes,saldo_apos,descricao,staff_id,tier_antes,tier_depois,tier_promovido)
  select c.id,'consumo',v_final,_valor_bruto,v_desc,v_antes,c.saldo_atual,
    case when v_desc>0 then _descricao||' · desconto '||v_desc||'%' else _descricao end,
    auth.uid(),v_tier,v_tier_depois,v_tier_depois<>v_tier
  from public.clientes c where c.id=_cliente_id returning * into r;
  return r;
end $$;

grant execute on function public.calcular_tier_cliente(uuid) to authenticated;
grant execute on function public.registar_recarga(uuid,numeric,text) to authenticated;
grant execute on function public.registar_consumo(uuid,numeric,text) to authenticated;

create or replace function public.obter_tiers_por_saldo()
returns table(nome text,ordem integer,limite_saldo numeric,desconto_percentual numeric)
language sql stable security definer set search_path=public
as $$
 select n.nome,n.ordem,
   case lower(n.nome) when 'platina' then 100000 when 'ouro' then 50000 when 'prata' then 20000 else 0 end::numeric,
   n.desconto_percentual
 from public.niveis_fidelidade n where n.ativo=true order by n.ordem;
$$;