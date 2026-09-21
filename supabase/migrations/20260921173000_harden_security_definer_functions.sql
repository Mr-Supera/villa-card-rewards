-- Security hardening: no SECURITY DEFINER function is executable by anonymous users.
-- Inventory of SECURITY DEFINER SQL functions currently used by Villa Card Rewards:
--   public.has_staff_permission(text)  -> DEFINER required for controlled RLS checks
--   public.registar_recarga(uuid,numeric,text) -> DEFINER required for atomic staff transaction
--   public.registar_consumo(uuid,numeric,text) -> DEFINER required for atomic staff transaction
--   public.calcular_tier_cliente(uuid) -> DEFINER retained because it is called by privileged
--       transaction functions; direct calls are restricted to authenticated users and authorization
--       is checked below.
--   public.obter_tiers_por_saldo() -> changed to INVOKER; authenticated users can already read
--       active tiers through RLS, so elevated privileges are unnecessary.
--   public.is_admin(uuid) -> DEFINER required to evaluate staff membership while staff RLS is active
--   public.is_staff(uuid) -> DEFINER required to evaluate staff membership while staff RLS is active

-- 1) The two pure read helpers do not need elevated privileges where RLS already permits the read.
create or replace function public.obter_tiers_por_saldo()
returns table(nome text,ordem integer,limite_saldo numeric,desconto_percentual numeric)
language sql
stable
security invoker
set search_path = public
as $$
 select n.nome,n.ordem,
   case lower(n.nome) when 'platina' then 100000 when 'ouro' then 50000 when 'prata' then 20000 else 0 end::numeric,
   n.desconto_percentual
 from public.niveis_fidelidade n
 where n.ativo=true
 order by n.ordem;
$$;

-- 2) Every remaining SECURITY DEFINER function is explicitly inaccessible to anon/public.
-- PostgreSQL grants EXECUTE on newly-created functions to PUBLIC by default, so this
-- explicit revoke is necessary even when the function is only intended for the app.
revoke all on function public.has_staff_permission(text) from public;
revoke all on function public.registar_recarga(uuid,numeric,text) from public;
revoke all on function public.registar_consumo(uuid,numeric,text) from public;
revoke all on function public.calcular_tier_cliente(uuid) from public;
revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_staff(uuid) from public;

revoke execute on function public.has_staff_permission(text) from anon;
revoke execute on function public.registar_recarga(uuid,numeric,text) from anon;
revoke execute on function public.registar_consumo(uuid,numeric,text) from anon;
revoke execute on function public.calcular_tier_cliente(uuid) from anon;
revoke execute on function public.is_admin(uuid) from anon;
revoke execute on function public.is_staff(uuid) from anon;

grant execute on function public.has_staff_permission(text) to authenticated;
grant execute on function public.registar_recarga(uuid,numeric,text) to authenticated;
grant execute on function public.registar_consumo(uuid,numeric,text) to authenticated;
grant execute on function public.calcular_tier_cliente(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;

-- 3) Defense in depth for the DEFINER helper that calculates a customer's tier:
-- authenticated users may calculate their own tier; only authorized staff/admin may calculate
-- someone else's tier. This prevents the DEFINER function from becoming a data oracle.
create or replace function public.calcular_tier_cliente(_cliente_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_tier text;
begin
  if _cliente_id <> auth.uid() and not public.has_staff_permission('clientes_read') then
    raise exception 'Sem permissão para consultar o tier deste cliente';
  end if;

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
  )
  into v_tier
  from public.clientes c
  where c.id=_cliente_id;

  if not found then
    raise exception 'Cliente não encontrado';
  end if;

  return v_tier;
end $$;

revoke all on function public.calcular_tier_cliente(uuid) from public;
grant execute on function public.calcular_tier_cliente(uuid) to authenticated;

-- 4) Ensure the privilege-check helpers themselves cannot be used by anon.
-- Their DEFINER status is intentional because staff RLS must be able to ask
-- "is this user staff/admin?" without recursively depending on staff RLS.
create or replace function public.is_admin(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.id = _user_id
      and (lower(coalesce(s.role,''))='admin'
           or lower(coalesce(s.cargo,'')) in ('admin','administrador'))
  );
$$;

create or replace function public.is_staff(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff s where s.id = _user_id);
$$;

revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_staff(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;

-- 5) Transaction functions remain DEFINER because they intentionally perform atomic,
-- privileged updates behind RLS. Their first authorization check is mandatory.
-- Existing bodies already enforce has_staff_permission('transacoes_write').
