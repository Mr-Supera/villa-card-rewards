-- ENUMS
CREATE TYPE public.tipo_transacao AS ENUM ('recarga', 'debito', 'estorno');
CREATE TYPE public.metodo_pagamento AS ENUM ('numerario', 'mpesa', 'emola', 'cartao', 'transferencia');
CREATE TYPE public.cargo_staff AS ENUM ('operador', 'administrador');
CREATE TYPE public.status_pedido AS ENUM ('pendente', 'confirmado', 'rejeitado');

-- NIVEIS
CREATE TABLE public.niveis_fidelidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  percentagem_desconto numeric(5,2) NOT NULL DEFAULT 0,
  saldo_minimo_acumulado numeric(12,2) NOT NULL DEFAULT 0,
  beneficios text NOT NULL DEFAULT '',
  cor_badge text NOT NULL DEFAULT '#9a8c61',
  ordem int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.niveis_fidelidade TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.niveis_fidelidade TO authenticated;
GRANT ALL ON public.niveis_fidelidade TO service_role;
ALTER TABLE public.niveis_fidelidade ENABLE ROW LEVEL SECURITY;

-- STAFF
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  nome_completo text NOT NULL,
  email text NOT NULL UNIQUE,
  cargo public.cargo_staff NOT NULL DEFAULT 'operador',
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- CLIENTES
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  nome_completo text NOT NULL,
  telefone text UNIQUE,
  email text UNIQUE,
  data_nascimento date,
  nfc_uid text UNIQUE,
  nivel_fidelidade_id uuid REFERENCES public.niveis_fidelidade(id) ON DELETE SET NULL,
  saldo numeric(12,2) NOT NULL DEFAULT 0,
  total_recarregado numeric(12,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- TRANSACOES
CREATE TABLE public.transacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo public.tipo_transacao NOT NULL,
  valor numeric(12,2) NOT NULL,
  valor_bruto numeric(12,2),
  desconto_aplicado numeric(5,2) NOT NULL DEFAULT 0,
  metodo_pagamento public.metodo_pagamento,
  descricao text NOT NULL DEFAULT '',
  saldo_resultante numeric(12,2) NOT NULL,
  processado_por uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_transacoes_cliente ON public.transacoes(cliente_id, criado_em DESC);
GRANT SELECT, INSERT ON public.transacoes TO authenticated;
GRANT ALL ON public.transacoes TO service_role;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;

-- PEDIDOS DE RECARGA
CREATE TABLE public.pedidos_recarga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  valor_solicitado numeric(12,2) NOT NULL CHECK (valor_solicitado > 0),
  metodo_preferido public.metodo_pagamento,
  status public.status_pedido NOT NULL DEFAULT 'pendente',
  processado_por uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.pedidos_recarga TO authenticated;
GRANT ALL ON public.pedidos_recarga TO service_role;
ALTER TABLE public.pedidos_recarga ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff WHERE user_id = _user_id AND ativo);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff WHERE user_id = _user_id AND ativo AND cargo = 'administrador');
$$;

CREATE OR REPLACE FUNCTION public.meu_staff_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.staff WHERE user_id = auth.uid() AND ativo;
$$;

CREATE OR REPLACE FUNCTION public.meu_cliente_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.clientes WHERE user_id = auth.uid();
$$;

-- POLICIES: niveis
CREATE POLICY "Todos podem ver niveis" ON public.niveis_fidelidade FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins gerem niveis" ON public.niveis_fidelidade FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- POLICIES: staff
CREATE POLICY "Staff ve proprio registo" ON public.staff FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins gerem staff" ON public.staff FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- POLICIES: clientes
CREATE POLICY "Cliente ve os seus dados" ON public.clientes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Cliente edita os seus dados" ON public.clientes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins gerem clientes" ON public.clientes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- POLICIES: transacoes
CREATE POLICY "Cliente ve as suas transacoes" ON public.transacoes FOR SELECT TO authenticated
  USING (cliente_id = public.meu_cliente_id() OR public.is_staff(auth.uid()));
CREATE POLICY "Staff cria transacoes" ON public.transacoes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- POLICIES: pedidos
CREATE POLICY "Cliente ve os seus pedidos" ON public.pedidos_recarga FOR SELECT TO authenticated
  USING (cliente_id = public.meu_cliente_id() OR public.is_staff(auth.uid()));
CREATE POLICY "Cliente cria pedidos" ON public.pedidos_recarga FOR INSERT TO authenticated
  WITH CHECK (cliente_id = public.meu_cliente_id());
CREATE POLICY "Staff actualiza pedidos" ON public.pedidos_recarga FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- NIVEL AUTOMATICO
CREATE OR REPLACE FUNCTION public.atribuir_nivel(_cliente_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nivel uuid; _total numeric;
BEGIN
  SELECT total_recarregado INTO _total FROM public.clientes WHERE id = _cliente_id;
  SELECT id INTO _nivel FROM public.niveis_fidelidade
    WHERE saldo_minimo_acumulado <= COALESCE(_total, 0)
    ORDER BY saldo_minimo_acumulado DESC LIMIT 1;
  UPDATE public.clientes SET nivel_fidelidade_id = _nivel WHERE id = _cliente_id;
END;
$$;

-- CRIAR CLIENTE AO REGISTAR
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nivel uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.staff WHERE email = NEW.email) THEN
    UPDATE public.staff SET user_id = NEW.id WHERE email = NEW.email;
    RETURN NEW;
  END IF;
  SELECT id INTO _nivel FROM public.niveis_fidelidade ORDER BY saldo_minimo_acumulado ASC LIMIT 1;
  INSERT INTO public.clientes (user_id, nome_completo, telefone, email, nivel_fidelidade_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', split_part(COALESCE(NEW.email, NEW.phone, 'Cliente'), '@', 1)),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'telefone',''), NULLIF(NEW.phone, '')),
    NULLIF(NEW.email, ''),
    _nivel
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- OPERACOES ATOMICAS
CREATE OR REPLACE FUNCTION public.registar_recarga(_cliente_id uuid, _valor numeric, _metodo public.metodo_pagamento, _descricao text DEFAULT 'Recarga ao balcão')
RETURNS public.transacoes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _novo numeric; _t public.transacoes;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  UPDATE public.clientes SET saldo = saldo + _valor, total_recarregado = total_recarregado + _valor
    WHERE id = _cliente_id AND ativo RETURNING saldo INTO _novo;
  IF _novo IS NULL THEN RAISE EXCEPTION 'Cliente inexistente ou inactivo'; END IF;
  INSERT INTO public.transacoes (cliente_id, tipo, valor, metodo_pagamento, descricao, saldo_resultante, processado_por)
  VALUES (_cliente_id, 'recarga', _valor, _metodo, _descricao, _novo, public.meu_staff_id())
  RETURNING * INTO _t;
  PERFORM public.atribuir_nivel(_cliente_id);
  RETURN _t;
END;
$$;

CREATE OR REPLACE FUNCTION public.registar_debito(_cliente_id uuid, _valor_bruto numeric, _descricao text DEFAULT 'Consumo no resort')
RETURNS public.transacoes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _desc numeric; _final numeric; _novo numeric; _t public.transacoes;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _valor_bruto <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  SELECT COALESCE(n.percentagem_desconto, 0) INTO _desc
    FROM public.clientes c LEFT JOIN public.niveis_fidelidade n ON n.id = c.nivel_fidelidade_id
    WHERE c.id = _cliente_id AND c.ativo;
  IF _desc IS NULL THEN RAISE EXCEPTION 'Cliente inexistente ou inactivo'; END IF;
  _final := round(_valor_bruto * (1 - _desc / 100), 2);
  UPDATE public.clientes SET saldo = saldo - _final
    WHERE id = _cliente_id AND saldo >= _final RETURNING saldo INTO _novo;
  IF _novo IS NULL THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  INSERT INTO public.transacoes (cliente_id, tipo, valor, valor_bruto, desconto_aplicado, descricao, saldo_resultante, processado_por)
  VALUES (_cliente_id, 'debito', _final, _valor_bruto, _desc, _descricao, _novo, public.meu_staff_id())
  RETURNING * INTO _t;
  RETURN _t;
END;
$$;

-- NIVEIS INICIAIS
INSERT INTO public.niveis_fidelidade (nome, percentagem_desconto, saldo_minimo_acumulado, beneficios, cor_badge, ordem) VALUES
('Bronze', 5, 0, E'5% de desconto no restaurante\nÁgua de boas-vindas\nAcesso à piscina principal', '#a97142', 1),
('Prata', 10, 10000, E'10% de desconto no restaurante\nAcesso ao lounge\nBrinde de aniversário', '#b9bec7', 2),
('Ouro', 15, 50000, E'15% de desconto em todo o resort\nAcesso a zonas exclusivas\nVisita guiada ao zoo gratuita\nBrinde de aniversário', '#d4af37', 3),
('Platina', 20, 150000, E'20% de desconto em todo o resort\nCheck-in prioritário\nZonas VIP e cabana privada\nExperiência no zoo para 2 pessoas', '#7fb3a4', 4);
