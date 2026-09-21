CREATE TABLE public.cartoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  codigo_nfc text NOT NULL UNIQUE,
  estado text NOT NULL DEFAULT 'ativo',
  data_emissao timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartoes TO authenticated;
GRANT ALL ON public.cartoes TO service_role;

ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente ve os seus cartoes" ON public.cartoes
  FOR SELECT TO authenticated
  USING (cliente_id = public.meu_cliente_id() OR public.is_staff(auth.uid()));

CREATE POLICY "Staff gere cartoes" ON public.cartoes
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX idx_cartoes_cliente ON public.cartoes(cliente_id);

CREATE TABLE public.vantagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  nivel_minimo_id uuid REFERENCES public.niveis_fidelidade(id) ON DELETE SET NULL,
  tipo_desconto text NOT NULL DEFAULT 'percentagem',
  valor_desconto numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vantagens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vantagens TO authenticated;
GRANT ALL ON public.vantagens TO service_role;

ALTER TABLE public.vantagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos veem vantagens" ON public.vantagens
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins gerem vantagens" ON public.vantagens
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));