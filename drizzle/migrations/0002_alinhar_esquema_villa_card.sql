-- ===== ENUM: novos tipos de transacao =====
ALTER TYPE public.tipo_transacao ADD VALUE IF NOT EXISTS 'consumo';
ALTER TYPE public.tipo_transacao ADD VALUE IF NOT EXISTS 'desconto';

-- ===== CLIENTES: colunas do novo modelo =====
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS contacto text,
  ADD COLUMN IF NOT EXISTS email_contacto text,
  ADD COLUMN IF NOT EXISTS data_registo timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS cartao_nfc_id uuid REFERENCES public.cartoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS saldo_atual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

ALTER TABLE public.clientes ALTER COLUMN nome_completo SET DEFAULT '';

UPDATE public.clientes SET
  nome = COALESCE(nome, nome_completo),
  contacto = COALESCE(contacto, telefone),
  saldo_atual = saldo,
  auth_user_id = COALESCE(auth_user_id, user_id),
  data_registo = criado_em;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_auth_user_id_key ON public.clientes(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- ===== TRANSACOES: colunas do novo modelo =====
ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS saldo_apos numeric,
  ADD COLUMN IF NOT EXISTS "timestamp" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS staff_id uuid;

ALTER TABLE public.transacoes ALTER COLUMN saldo_resultante SET DEFAULT 0;
UPDATE public.transacoes SET saldo_apos = saldo_resultante, "timestamp" = criado_em WHERE saldo_apos IS NULL;

-- ===== STAFF =====
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'staff';
ALTER TABLE public.staff ALTER COLUMN nome_completo SET DEFAULT '';
UPDATE public.staff SET nome = COALESCE(nome, nome_completo);

-- ===== NIVEIS =====
ALTER TABLE public.niveis_fidelidade
  ADD COLUMN IF NOT EXISTS desconto_percentual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
UPDATE public.niveis_fidelidade SET desconto_percentual = percentagem_desconto, descricao = COALESCE(descricao, beneficios), nome = lower(nome);

-- ===== VANTAGENS: tier_minimo =====
ALTER TABLE public.vantagens ADD COLUMN IF NOT EXISTS tier_minimo text NOT NULL DEFAULT 'bronze';

-- ===== SINCRONIZACAO DE COLUNAS LEGADO/NOVAS =====
CREATE OR REPLACE FUNCTION public.sync_clientes_cols()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.nome := COALESCE(NEW.nome, NULLIF(NEW.nome_completo, ''), 'Cliente');
    NEW.nome_completo := NEW.nome;
    NEW.contacto := COALESCE(NEW.contacto, NEW.telefone);
    NEW.telefone := NEW.contacto;
    NEW.auth_user_id := COALESCE(NEW.auth_user_id, NEW.user_id);
    NEW.user_id := NEW.auth_user_id;
    IF NEW.saldo_atual <> 0 THEN NEW.saldo := NEW.saldo_atual; ELSE NEW.saldo_atual := NEW.saldo; END IF;
  ELSE
    IF NEW.nome IS DISTINCT FROM OLD.nome THEN NEW.nome_completo := NEW.nome;
    ELSIF NEW.nome_completo IS DISTINCT FROM OLD.nome_completo THEN NEW.nome := NEW.nome_completo; END IF;
    IF NEW.contacto IS DISTINCT FROM OLD.contacto THEN NEW.telefone := NEW.contacto;
    ELSIF NEW.telefone IS DISTINCT FROM OLD.telefone THEN NEW.contacto := NEW.telefone; END IF;
    IF NEW.saldo_atual IS DISTINCT FROM OLD.saldo_atual THEN NEW.saldo := NEW.saldo_atual;
    ELSIF NEW.saldo IS DISTINCT FROM OLD.saldo THEN NEW.saldo_atual := NEW.saldo; END IF;
    IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN NEW.user_id := NEW.auth_user_id;
    ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id THEN NEW.auth_user_id := NEW.user_id; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_clientes ON public.clientes;
CREATE TRIGGER trg_sync_clientes BEFORE INSERT OR UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.sync_clientes_cols();

CREATE OR REPLACE FUNCTION public.sync_transacoes_cols()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.saldo_apos := COALESCE(NEW.saldo_apos, NEW.saldo_resultante);
  NEW.saldo_resultante := NEW.saldo_apos;
  NEW."timestamp" := COALESCE(NEW."timestamp", now());
  NEW.criado_em := NEW."timestamp";
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_transacoes ON public.transacoes;
CREATE TRIGGER trg_sync_transacoes BEFORE INSERT ON public.transacoes
  FOR EACH ROW EXECUTE FUNCTION public.sync_transacoes_cols();

CREATE OR REPLACE FUNCTION public.sync_staff_cols()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.nome := COALESCE(NEW.nome, NULLIF(NEW.nome_completo, ''), NEW.email);
  NEW.nome_completo := NEW.nome;
  IF NEW.role IN ('admin','administrador') THEN NEW.cargo := 'administrador'; END IF;
  NEW.user_id := COALESCE(NEW.user_id, NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_staff ON public.staff;
CREATE TRIGGER trg_sync_staff BEFORE INSERT OR UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.sync_staff_cols();

CREATE OR REPLACE FUNCTION public.sync_niveis_cols()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.nome := lower(NEW.nome);
  IF NEW.desconto_percentual <> 0 THEN NEW.percentagem_desconto := NEW.desconto_percentual;
  ELSE NEW.desconto_percentual := NEW.percentagem_desconto; END IF;
  NEW.beneficios := COALESCE(NEW.descricao, NEW.beneficios, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_niveis ON public.niveis_fidelidade;
CREATE TRIGGER trg_sync_niveis BEFORE INSERT OR UPDATE ON public.niveis_fidelidade
  FOR EACH ROW EXECUTE FUNCTION public.sync_niveis_cols();

-- ===== HELPERS: aceitar staff.id = auth.uid() =====
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff WHERE (user_id = _user_id OR id = _user_id) AND ativo);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE (user_id = _user_id OR id = _user_id) AND ativo
      AND (cargo = 'administrador' OR lower(role) IN ('admin','administrador'))
  );
$$;

CREATE OR REPLACE FUNCTION public.meu_cliente_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.clientes WHERE user_id = auth.uid() OR auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.meu_staff_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.staff WHERE (user_id = auth.uid() OR id = auth.uid()) AND ativo LIMIT 1;
$$;

-- ===== RLS: leitura propria com auth_user_id =====
DROP POLICY IF EXISTS "Cliente ve os seus dados" ON public.clientes;
CREATE POLICY "Cliente ve os seus dados" ON public.clientes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR auth_user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Cliente edita os seus dados" ON public.clientes;
CREATE POLICY "Cliente edita os seus dados" ON public.clientes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR auth_user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Staff ve proprio registo" ON public.staff;
CREATE POLICY "Staff ve proprio registo" ON public.staff
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR id = auth.uid() OR public.is_admin(auth.uid()));

-- ===== NIVEL / TIER =====
CREATE OR REPLACE FUNCTION public.atribuir_nivel(_cliente_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nivel uuid; _nome text; _total numeric;
BEGIN
  SELECT total_recarregado INTO _total FROM public.clientes WHERE id = _cliente_id;
  SELECT id, nome INTO _nivel, _nome FROM public.niveis_fidelidade
    WHERE saldo_minimo_acumulado <= COALESCE(_total, 0)
    ORDER BY saldo_minimo_acumulado DESC LIMIT 1;
  UPDATE public.clientes SET nivel_fidelidade_id = _nivel, tier = COALESCE(lower(_nome), tier) WHERE id = _cliente_id;
END;
$$;

-- ===== TRANSACOES ATOMICAS =====
CREATE OR REPLACE FUNCTION public.registar_recarga(_cliente_id uuid, _valor numeric, _descricao text DEFAULT 'Recarga ao balcão')
RETURNS public.transacoes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _novo numeric; _t public.transacoes;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  UPDATE public.clientes SET saldo_atual = saldo_atual + _valor, total_recarregado = total_recarregado + _valor
    WHERE id = _cliente_id AND ativo RETURNING saldo_atual INTO _novo;
  IF _novo IS NULL THEN RAISE EXCEPTION 'Cliente inexistente ou inactivo'; END IF;
  INSERT INTO public.transacoes (cliente_id, tipo, valor, descricao, saldo_apos, saldo_resultante, processado_por, staff_id)
  VALUES (_cliente_id, 'recarga', _valor, _descricao, _novo, _novo, public.meu_staff_id(), public.meu_staff_id())
  RETURNING * INTO _t;
  PERFORM public.atribuir_nivel(_cliente_id);
  RETURN _t;
END;
$$;

CREATE OR REPLACE FUNCTION public.registar_consumo(_cliente_id uuid, _valor_bruto numeric, _descricao text DEFAULT 'Consumo no resort')
RETURNS public.transacoes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _desc numeric; _final numeric; _novo numeric; _t public.transacoes;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _valor_bruto <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  SELECT COALESCE(n.desconto_percentual, 0) INTO _desc
    FROM public.clientes c LEFT JOIN public.niveis_fidelidade n ON lower(n.nome) = lower(c.tier)
    WHERE c.id = _cliente_id AND c.ativo;
  IF _desc IS NULL THEN RAISE EXCEPTION 'Cliente inexistente ou inactivo'; END IF;
  _final := round(_valor_bruto * (1 - _desc / 100), 2);
  UPDATE public.clientes SET saldo_atual = saldo_atual - _final
    WHERE id = _cliente_id AND saldo_atual >= _final RETURNING saldo_atual INTO _novo;
  IF _novo IS NULL THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  INSERT INTO public.transacoes (cliente_id, tipo, valor, valor_bruto, desconto_aplicado, descricao, saldo_apos, saldo_resultante, processado_por, staff_id)
  VALUES (_cliente_id, 'consumo', _final, _valor_bruto, _desc, _descricao, _novo, _novo, public.meu_staff_id(), public.meu_staff_id())
  RETURNING * INTO _t;
  RETURN _t;
END;
$$;

-- ===== NOVO UTILIZADOR AUTH =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nivel uuid; _nome text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.staff WHERE email = NEW.email) THEN
    UPDATE public.staff SET user_id = NEW.id WHERE email = NEW.email;
    RETURN NEW;
  END IF;
  SELECT id, nome INTO _nivel, _nome FROM public.niveis_fidelidade ORDER BY saldo_minimo_acumulado ASC LIMIT 1;
  INSERT INTO public.clientes (auth_user_id, user_id, nome, contacto, email, nivel_fidelidade_id, tier)
  VALUES (
    NEW.id, NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.raw_user_meta_data->>'nome', split_part(COALESCE(NEW.email, NEW.phone, 'Cliente'), '@', 1)),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'telefone',''), NULLIF(NEW.phone, '')),
    NULLIF(NEW.email, ''),
    _nivel,
    COALESCE(lower(_nome), 'bronze')
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;