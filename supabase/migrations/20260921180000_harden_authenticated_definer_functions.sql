-- Second-stage SECURITY DEFINER hardening:
-- Every remaining DEFINER function callable by authenticated must enforce its intended audience
-- inside the function body. Transaction functions already reject non-staff via has_staff_permission.
-- Privilege introspection helpers are restricted to the caller's own identity unless the caller
-- is already an admin.

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
        lower(coalesce(s.role,'')) in ('admin','staff')
        or lower(coalesce(s.cargo,'')) in ('admin','administrador')
      )
      and (
        lower(coalesce(s.role,'')) = 'admin'
        or lower(coalesce(s.cargo,'')) in ('admin','administrador')
        or coalesce((s.permissoes ->> permission_name)::boolean,false)
        or coalesce((s.permissoes ->> 'admin')::boolean,false)
      )
  );
$$;

create or replace function public.is_admin(_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _user_id <> auth.uid() and not exists (
    select 1 from public.staff s
    where s.id = auth.uid()
      and (lower(coalesce(s.role,''))='admin'
           or lower(coalesce(s.cargo,'')) in ('admin','administrador'))
  ) then
    raise exception 'Sem permissão para consultar o papel de outro utilizador';
  end if;

  return exists (
    select 1 from public.staff s
    where s.id = _user_id
      and (lower(coalesce(s.role,''))='admin'
           or lower(coalesce(s.cargo,'')) in ('admin','administrador'))
  );
end;
$$;

create or replace function public.is_staff(_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _user_id <> auth.uid() and not public.is_admin(auth.uid()) then
    raise exception 'Sem permissão para consultar outro utilizador';
  end if;
  return exists (select 1 from public.staff s where s.id = _user_id);
end;
$$;

-- Transaction RPCs: explicit authorization remains mandatory inside the DEFINER body.
create or replace function public.registar_recarga(
  _cliente_id uuid, _valor numeric, _descricao text default 'Recarga ao balcão'
)
returns public.transacoes
language plpgsql
security definer
set search_path = public
as $$
declare r public.transacoes; v_antes numeric; v_depois numeric; v_tier_antes text; v_tier_depois text;
begin
  if not public.has_staff_permission('transacoes_write') then
    raise exception 'Sem permissão para registar transações';
  end if;
  if _valor <= 0 then raise exception 'O valor deve ser maior que zero'; end if;
  select saldo_atual,tier into v_antes,v_tier_antes from public.clientes where id=_cliente_id for update;
  if not found then raise exception 'Cliente não encontrado'; end if;
  update public.clientes set saldo_atual=saldo_atual+_valor, saldo_acumulado_historico=saldo_acumulado_historico+_valor where id=_cliente_id returning saldo_atual into v_depois;
  v_tier_depois=public.calcular_tier_cliente(_cliente_id);
  update public.clientes set tier=v_tier_depois where id=_cliente_id;
  insert into public.transacoes(cliente_id,tipo,valor,valor_bruto,desconto_percentual,saldo_antes,saldo_apos,descricao,staff_id,tier_antes,tier_depois,tier_promovido)
  values(_cliente_id,'recarga',_valor,_valor,0,v_antes,v_depois,_descricao,auth.uid(),v_tier_antes,v_tier_depois,v_tier_depois<>v_tier_antes)
  returning * into r;
  return r;
end;
$$;

create or replace function public.registar_consumo(
  _cliente_id uuid, _valor_bruto numeric, _descricao text default 'Consumo'
)
returns public.transacoes
language plpgsql
security definer
set search_path = public
as $$
declare r public.transacoes; v_antes numeric; v_final numeric; v_desc numeric; v_tier text; v_tier_depois text;
begin
  if not public.has_staff_permission('transacoes_write') then
    raise exception 'Sem permissão para registar transações';
  end if;
  if _valor_bruto <= 0 then raise exception 'O valor deve ser maior que zero'; end if;
  select saldo_atual,tier into v_antes,v_tier from public.clientes where id=_cliente_id for update;
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
end;
$$;

revoke all on function public.has_staff_permission(text) from public;
revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_staff(uuid) from public;
revoke all on function public.registar_recarga(uuid,numeric,text) from public;
revoke all on function public.registar_consumo(uuid,numeric,text) from public;
revoke all on function public.calcular_tier_cliente(uuid) from public;

revoke execute on function public.has_staff_permission(text) from anon;
revoke execute on function public.is_admin(uuid) from anon;
revoke execute on function public.is_staff(uuid) from anon;
revoke execute on function public.registar_recarga(uuid,numeric,text) from anon;
revoke execute on function public.registar_consumo(uuid,numeric,text) from anon;
revoke execute on function public.calcular_tier_cliente(uuid) from anon;

grant execute on function public.has_staff_permission(text) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.registar_recarga(uuid,numeric,text) to authenticated;
grant execute on function public.registar_consumo(uuid,numeric,text) to authenticated;
grant execute on function public.calcular_tier_cliente(uuid) to authenticated;

-- SECURITY DEFINER allow-list for this application:
-- has_staff_permission, is_admin, is_staff: authenticated identity/role checks only.
-- registar_recarga, registar_consumo: staff/admin only, enforced inside the function.
-- calcular_tier_cliente: own client or staff/admin, enforced inside the function.
-- obter_tiers_por_saldo is SECURITY INVOKER and therefore not privileged.
