import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NivelBadge } from "@/components/NivelBadge";
import { formatData, formatMZN } from "@/lib/format";
import { ArrowDownLeft, ArrowUpRight, CreditCard, LogOut, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "O meu Villa Card" },
      {
        name: "description",
        content: "Saldo, nível de fidelidade, vantagens e histórico do seu Villa Card.",
      },
      { property: "og:title", content: "O meu Villa Card" },
      {
        property: "og:description",
        content: "Saldo, nível de fidelidade, vantagens e histórico do seu Villa Card.",
      },
    ],
  }),
  component: PainelCliente,
});

type Periodo = "7" | "30" | "90" | "todos";

function PainelCliente() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [qr, setQr] = useState<string | null>(null);

  const clienteQuery = useQuery({
    queryKey: ["cliente"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão inválida");
      const { data, error } = await supabase
        .from("clientes")
        .select("*, niveis_fidelidade(*)")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const cliente = clienteQuery.data;
  const nivel = cliente?.niveis_fidelidade ?? null;

  const niveisQuery = useQuery({
    queryKey: ["niveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("niveis_fidelidade")
        .select("*")
        .order("saldo_minimo_acumulado", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const transacoesQuery = useQuery({
    queryKey: ["transacoes", cliente?.id, periodo],
    enabled: !!cliente?.id,
    queryFn: async () => {
      let q = supabase
        .from("transacoes")
        .select("*")
        .eq("cliente_id", cliente!.id)
        .order("criado_em", { ascending: false });
      if (periodo !== "todos") {
        const desde = new Date();
        desde.setDate(desde.getDate() - Number(periodo));
        q = q.gte("criado_em", desde.toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const pedidosQuery = useQuery({
    queryKey: ["pedidos", cliente?.id],
    enabled: !!cliente?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_recarga")
        .select("*")
        .eq("cliente_id", cliente!.id)
        .order("criado_em", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!cliente?.id) return;
    QRCode.toDataURL(cliente.id, {
      width: 320,
      margin: 1,
      color: { dark: "#1b2c25", light: "#f3ead6" },
    }).then(setQr);
  }, [cliente?.id]);

  const proximoNivel = useMemo(() => {
    if (!cliente || !niveisQuery.data) return null;
    const total = Number(cliente.total_recarregado);
    return niveisQuery.data.find((n) => Number(n.saldo_minimo_acumulado) > total) ?? null;
  }, [cliente, niveisQuery.data]);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (clienteQuery.isLoading) {
    return <div className="p-10 text-center text-muted-foreground">A carregar o seu cartão…</div>;
  }

  if (!cliente) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-2xl">Conta sem perfil de cliente</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta conta não tem um perfil de cliente associado. Contacte a recepção do resort.
        </p>
        <Button className="mt-6" variant="outline" onClick={sair}>
          Terminar sessão
        </Button>
      </div>
    );
  }

  const beneficios = (nivel?.beneficios ?? "").split("\n").filter(Boolean);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.35em] text-primary">
            Villa das Palmeiras
          </p>
          <h1 className="text-2xl">Olá, {cliente.nome_completo.split(" ")[0]}</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={sair} aria-label="Terminar sessão">
          <LogOut className="size-5" />
        </Button>
      </header>

      {/* CARTÃO */}
      <section className="card-premium mt-6 rounded-3xl p-6">
        <div className="flex items-start justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Saldo atual</p>
          <NivelBadge
            nome={nivel?.nome}
            cor={nivel?.cor_badge}
            desconto={nivel?.percentagem_desconto}
          />
        </div>
        <p className="mt-3 text-5xl font-light text-gold-gradient sm:text-6xl">
          {formatMZN(cliente.saldo)}
        </p>
        <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
          <CreditCard className="size-4" />
          {cliente.nfc_uid ? (
            <span>Cartão NFC associado · {cliente.nfc_uid.slice(-6).toUpperCase()}</span>
          ) : (
            <span>Sem cartão físico associado — levante o seu na recepção</span>
          )}
        </div>
        {proximoNivel && (
          <p className="mt-4 text-xs text-muted-foreground">
            Faltam {formatMZN(Number(proximoNivel.saldo_minimo_acumulado) - Number(cliente.total_recarregado))}{" "}
            em recargas para atingir o nível {proximoNivel.nome}.
          </p>
        )}
        <PedirRecarga clienteId={cliente.id} />
      </section>

      <Tabs defaultValue="historico" className="mt-8">
        <TabsList className="grid w-full grid-cols-4 bg-secondary">
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="vantagens">Vantagens</TabsTrigger>
          <TabsTrigger value="qr">QR</TabsTrigger>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl">Transações</h2>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="todos">Tudo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(pedidosQuery.data ?? []).filter((p) => p.status === "pendente").length > 0 && (
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm">
              Tem pedidos de recarga pendentes de confirmação na recepção.
            </div>
          )}

          {transacoesQuery.data?.length ? (
            <ul className="space-y-2">
              {transacoesQuery.data.map((t) => {
                const entrada = t.tipo === "recarga" || t.tipo === "estorno";
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid size-9 place-items-center rounded-full ${
                          entrada ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {entrada ? (
                          <ArrowDownLeft className="size-4" />
                        ) : (
                          <ArrowUpRight className="size-4" />
                        )}
                      </span>
                      <div>
                        <p className="text-sm">{t.descricao || (entrada ? "Recarga" : "Consumo")}</p>
                        <p className="text-xs text-muted-foreground">{formatData(t.criado_em)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm ${entrada ? "text-success" : "text-foreground"}`}>
                        {entrada ? "+" : "−"} {formatMZN(t.valor)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saldo: {formatMZN(t.saldo_resultante)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
              Ainda não há transações neste período.
            </p>
          )}
        </TabsContent>

        <TabsContent value="vantagens" className="mt-5">
          <h2 className="text-xl">Minhas vantagens</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nível {nivel?.nome ?? "—"} · {Number(nivel?.percentagem_desconto ?? 0)}% de desconto
            aplicado automaticamente nos consumos.
          </p>
          <ul className="mt-4 space-y-2">
            {beneficios.length ? (
              beneficios.map((b) => (
                <li key={b} className="rounded-2xl border border-border bg-card/60 p-4 text-sm">
                  {b}
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">Sem vantagens definidas.</li>
            )}
          </ul>
        </TabsContent>

        <TabsContent value="qr" className="mt-5 text-center">
          <h2 className="text-xl">O meu QR pessoal</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Apresente este código ao balcão caso não tenha o cartão consigo.
          </p>
          {qr && (
            <img
              src={qr}
              alt="Código QR pessoal"
              width={320}
              height={320}
              className="mx-auto mt-6 w-64 rounded-3xl border border-primary/30 p-3"
            />
          )}
          <p className="mt-4 text-xs text-muted-foreground">ID: {cliente.id}</p>
        </TabsContent>

        <TabsContent value="perfil" className="mt-5">
          <PerfilForm cliente={cliente} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function PedirRecarga({ clienteId }: { clienteId: string }) {
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [metodo, setMetodo] = useState<string>("mpesa");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pedidos_recarga").insert({
        cliente_id: clienteId,
        valor_solicitado: Number(valor),
        metodo_preferido: metodo as "mpesa",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido de recarga enviado", {
        description: "Será confirmado pela equipa do resort.",
      });
      setAberto(false);
      setValor("");
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
    onError: (e: Error) => toast.error("Não foi possível enviar o pedido", { description: e.message }),
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className="surface-gold mt-6 w-full">
          <Plus className="size-4" /> Pedir recarga
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedir recarga</DialogTitle>
          <DialogDescription>
            O pedido fica pendente até ser confirmado ao balcão do resort.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="valor">Valor (MZN)</Label>
            <Input
              id="valor"
              type="number"
              min="1"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Método preferido</Label>
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
        </div>
        <DialogFooter>
          <Button
            className="surface-gold w-full"
            disabled={!valor || Number(valor) <= 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "A enviar…" : "Enviar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ClienteRow = {
  id: string;
  nome_completo: string;
  telefone: string | null;
  email: string | null;
  data_nascimento: string | null;
};

function PerfilForm({ cliente }: { cliente: ClienteRow }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(cliente.nome_completo);
  const [telefone, setTelefone] = useState(cliente.telefone ?? "");
  const [nascimento, setNascimento] = useState(cliente.data_nascimento ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("clientes")
        .update({
          nome_completo: nome,
          telefone: telefone || null,
          data_nascimento: nascimento || null,
        })
        .eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados actualizados");
      queryClient.invalidateQueries({ queryKey: ["cliente"] });
    },
    onError: (e: Error) => toast.error("Não foi possível guardar", { description: e.message }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h2 className="text-xl">Perfil</h2>
      <div className="space-y-2">
        <Label htmlFor="p-nome">Nome completo</Label>
        <Input id="p-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-tel">Telefone</Label>
        <Input
          id="p-tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="+258 84 000 0000"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-email">Email</Label>
        <Input id="p-email" value={cliente.email ?? ""} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-nasc">Data de nascimento</Label>
        <Input
          id="p-nasc"
          type="date"
          value={nascimento}
          onChange={(e) => setNascimento(e.target.value)}
        />
      </div>
      <Button type="submit" className="surface-gold w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "A guardar…" : "Guardar alterações"}
      </Button>
    </form>
  );
}
