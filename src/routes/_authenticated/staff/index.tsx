import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeitorCartao, type LeituraCartao } from "@/components/LeitorCartao";
import { NivelBadge } from "@/components/NivelBadge";
import { formatData, formatMZN } from "@/lib/format";
import { AlertTriangle, CreditCard, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/")({
  head: () => ({
    meta: [
      { title: "Atendimento ao balcão · Villa Card" },
      {
        name: "description",
        content: "Identificação de clientes por cartão NFC ou QR, débitos e recargas ao balcão.",
      },
      { property: "og:title", content: "Atendimento ao balcão · Villa Card" },
      {
        property: "og:description",
        content: "Identificação de clientes por cartão NFC ou QR, débitos e recargas ao balcão.",
      },
    ],
  }),
  component: Atendimento,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ClienteBalcao = {
  id: string;
  nome_completo: string;
  telefone: string | null;
  saldo: number | string;
  nfc_uid: string | null;
  ativo: boolean;
  niveis_fidelidade: {
    nome: string;
    cor_badge: string;
    percentagem_desconto: number | string;
  } | null;
};

function Atendimento() {
  const queryClient = useQueryClient();
  const [cliente, setCliente] = useState<ClienteBalcao | null>(null);

  const identificar = useMutation({
    mutationFn: async ({ tipo, valor }: LeituraCartao) => {
      const porId = tipo === "qr" || UUID.test(valor);
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_completo, telefone, saldo, nfc_uid, ativo, niveis_fidelidade(*)")
        .eq(porId ? "id" : "nfc_uid", porId ? valor : valor.toUpperCase())
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Nenhum cliente corresponde a esta leitura.");
      return data as unknown as ClienteBalcao;
    },
    onSuccess: (c) => setCliente(c),
    onError: (e: Error) => toast.error("Cliente não identificado", { description: e.message }),
  });

  const recarregarCliente = async (id: string) => {
    const { data } = await supabase
      .from("clientes")
      .select("id, nome_completo, telefone, saldo, nfc_uid, ativo, niveis_fidelidade(*)")
      .eq("id", id)
      .maybeSingle();
    if (data) setCliente(data as unknown as ClienteBalcao);
    queryClient.invalidateQueries({ queryKey: ["movimentos-dia"] });
  };

  const movimentos = useQuery({
    queryKey: ["movimentos-dia"],
    queryFn: async () => {
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("transacoes")
        .select("*, clientes(nome_completo)")
        .gte("criado_em", inicio.toISOString())
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totais = (movimentos.data ?? []).reduce(
    (acc, t) => {
      if (t.tipo === "debito") acc.debitos += Number(t.valor);
      else acc.recargas += Number(t.valor);
      return acc;
    },
    { debitos: 0, recargas: 0 },
  );

  return (
    <main className="mt-6 space-y-6">
      <LeitorCartao onLeitura={(l) => identificar.mutate(l)} ocupado={identificar.isPending} />

      {cliente && (
        <FichaCliente
          cliente={cliente}
          onFechar={() => setCliente(null)}
          onActualizar={() => recarregarCliente(cliente.id)}
        />
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Movimentos de hoje</h2>
          <p className="text-sm text-muted-foreground">
            Recargas {formatMZN(totais.recargas)} · Consumos {formatMZN(totais.debitos)}
          </p>
        </div>
        <ul className="mt-4 space-y-2">
          {movimentos.data?.length ? (
            movimentos.data.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4"
              >
                <div>
                  <p className="text-sm">
                    {t.clientes?.nome_completo ?? "Cliente"} ·{" "}
                    {t.tipo === "debito" ? "Consumo" : "Recarga"}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatData(t.criado_em)}</p>
                </div>
                <p className="text-sm">{formatMZN(t.valor)}</p>
              </li>
            ))
          ) : (
            <li className="rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
              Ainda não há movimentos hoje.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}

function FichaCliente({
  cliente,
  onFechar,
  onActualizar,
}: {
  cliente: ClienteBalcao;
  onFechar: () => void;
  onActualizar: () => void;
}) {
  const [valorConsumo, setValorConsumo] = useState("");
  const [valorRecarga, setValorRecarga] = useState("");
  const [metodo, setMetodo] = useState("numerario");

  const desconto = Number(cliente.niveis_fidelidade?.percentagem_desconto ?? 0);
  const bruto = Number(valorConsumo || 0);
  const final = Math.round(bruto * (1 - desconto / 100) * 100) / 100;
  const saldo = Number(cliente.saldo);
  const insuficiente = bruto > 0 && final > saldo;

  const debitar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("registar_debito", {
        _cliente_id: cliente.id,
        _valor_bruto: bruto,
        _descricao: "Consumo no resort",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Débito de ${formatMZN(final)} registado`);
      setValorConsumo("");
      onActualizar();
    },
    onError: (e: Error) => toast.error("Débito não efectuado", { description: e.message }),
  });

  const recarregar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("registar_recarga", {
        _cliente_id: cliente.id,
        _valor: Number(valorRecarga),
        _metodo: metodo as "numerario",
        _descricao: "Recarga ao balcão",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Recarga de ${formatMZN(Number(valorRecarga))} registada`);
      setValorRecarga("");
      onActualizar();
    },
    onError: (e: Error) => toast.error("Recarga não efectuada", { description: e.message }),
  });

  return (
    <section className="card-premium rounded-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl">{cliente.nome_completo}</h2>
          <p className="text-xs text-muted-foreground">
            {cliente.telefone ?? "Sem telefone"} ·{" "}
            {cliente.nfc_uid ? `Cartão ${cliente.nfc_uid}` : "Sem cartão físico"}
          </p>
          <div className="mt-3">
            <NivelBadge
              nome={cliente.niveis_fidelidade?.nome}
              cor={cliente.niveis_fidelidade?.cor_badge}
              desconto={cliente.niveis_fidelidade?.percentagem_desconto}
            />
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Saldo</p>
          <p className="text-3xl font-light text-gold-gradient">{formatMZN(saldo)}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar ficha">
          <X className="size-5" />
        </Button>
      </div>

      {!cliente.ativo && (
        <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Cliente inactivo — não é possível registar movimentos.
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <h3 className="text-lg">Debitar consumo</h3>
          <div className="space-y-2">
            <Label htmlFor="consumo">Valor da compra (MZN)</Label>
            <Input
              id="consumo"
              type="number"
              min="0"
              step="0.01"
              value={valorConsumo}
              onChange={(e) => setValorConsumo(e.target.value)}
            />
          </div>
          {bruto > 0 && (
            <p className="text-sm text-muted-foreground">
              Desconto {desconto}% · a debitar{" "}
              <span className="text-foreground">{formatMZN(final)}</span>
            </p>
          )}
          {insuficiente && (
            <p className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="size-4" /> Saldo insuficiente — faltam{" "}
              {formatMZN(final - saldo)}.
            </p>
          )}
          <Button
            className="surface-gold w-full"
            disabled={!bruto || insuficiente || !cliente.ativo || debitar.isPending}
            onClick={() => debitar.mutate()}
          >
            {debitar.isPending ? "A processar…" : "Debitar"}
          </Button>
        </div>

        <div className="space-y-3 rounded-2xl border border-border p-4">
          <h3 className="text-lg">Recarregar</h3>
          <div className="space-y-2">
            <Label htmlFor="recarga">Valor (MZN)</Label>
            <Input
              id="recarga"
              type="number"
              min="0"
              step="0.01"
              value={valorRecarga}
              onChange={(e) => setValorRecarga(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Método de pagamento</Label>
            <Select value={metodo} onValueChange={setMetodo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="numerario">Numerário</SelectItem>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="emola">e-Mola</SelectItem>
                <SelectItem value="cartao">Cartão bancário</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={!Number(valorRecarga) || !cliente.ativo || recarregar.isPending}
            onClick={() => recarregar.mutate()}
          >
            <CreditCard className="size-4" />
            {recarregar.isPending ? "A processar…" : "Recarregar"}
          </Button>
        </div>
      </div>
    </section>
  );
}
