import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  LogOut,
  Pencil,
  Plus,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMZN } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Villa Card Rewards | Meu Cartão" },
      { name: "description", content: "Saldo, cartão, vantagens, transações e perfil do Villa Card." },
    ],
  }),
  component: PainelCliente,
});

type Cliente = {
  id: string;
  nome: string;
  contacto: string | null;
  email: string | null;
  data_registo: string;
  cartao_nfc_id: string | null;
  saldo_atual: number;
  tier: string;
};

type Cartao = {
  id: string;
  cliente_id: string;
  codigo_nfc: string;
  estado: "ativo" | "bloqueado" | "perdido";
  data_emissao: string;
};

type Transacao = {
  id: string;
  tipo: "recarga" | "consumo" | "desconto";
  valor: number;
  saldo_apos: number;
  descricao: string | null;
  timestamp: string;
};

type Vantagem = {
  id: string;
  nome: string;
  descricao: string | null;
  tier_minimo: string;
  tipo_desconto: string;
  valor_desconto: number;
};

const tierRank: Record<string, number> = { bronze: 1, prata: 2, ouro: 3, platina: 4 };

function PainelCliente() {
  const queryClient = useQueryClient();
  const [periodo, setPeriodo] = useState("30");
  const [tipo, setTipo] = useState("todos");
  const [editar, setEditar] = useState(false);

  const clienteQuery = useQuery({
    queryKey: ["cliente"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão inválida.");
      const { data, error } = await supabase.from("clientes").select("*").or(`auth_user_id.eq.${auth.user.id},id.eq.${auth.user.id}`).limit(1).single();
      if (error) throw error;
      return data as Cliente;
    },
  });

  const cliente = clienteQuery.data;

  const cartaoQuery = useQuery({
    queryKey: ["cartao", cliente?.cartao_nfc_id],
    enabled: !!cliente?.cartao_nfc_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("cartoes").select("*").eq("id", cliente!.cartao_nfc_id!).single();
      if (error) throw error;
      return data as Cartao;
    },
  });

  const transacoesQuery = useQuery({
    queryKey: ["transacoes", cliente?.id, periodo, tipo],
    enabled: !!cliente?.id,
    queryFn: async () => {
      let query = supabase.from("transacoes").select("*").eq("cliente_id", cliente!.id).order("timestamp", { ascending: false });
      if (periodo !== "todos") {
        const date = new Date();
        date.setDate(date.getDate() - Number(periodo));
        query = query.gte("timestamp", date.toISOString());
      }
      if (tipo !== "todos") query = query.eq("tipo", tipo);
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data ?? []) as Transacao[];
    },
  });

  const vantagensQuery = useQuery({
    queryKey: ["vantagens", cliente?.tier],
    enabled: !!cliente?.tier,
    queryFn: async () => {
      const rank = tierRank[cliente!.tier.toLowerCase()] ?? 1;
      const { data, error } = await supabase.from("vantagens").select("*");
      if (error) throw error;
      return ((data ?? []) as Vantagem[]).filter((v) => (tierRank[v.tier_minimo.toLowerCase()] ?? 99) <= rank);
    },
  });

  const sair = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    window.location.href = "/auth";
  };

  if (clienteQuery.isLoading) {
    return <main className="grid min-h-screen place-items-center p-6 text-muted-foreground">A carregar o seu Villa Card…</main>;
  }

  if (clienteQuery.error || !cliente) {
    return <main className="mx-auto max-w-md p-8 text-center"><h1 className="text-2xl">Perfil não encontrado</h1><p className="mt-2 text-sm text-muted-foreground">Não foi possível carregar o perfil deste cliente.</p><Button className="mt-6" onClick={sair}>Terminar sessão</Button></main>;
  }

  const tier = cliente.tier.charAt(0).toUpperCase() + cliente.tier.slice(1);
  const cardActive = cartaoQuery.data?.estado === "ativo";

  return (
    <main className="min-h-screen bg-background pb-24">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.3em] text-primary">Villa das Palmeiras</p>
            <h1 className="mt-1 text-2xl sm:text-3xl">Olá, {cliente.nome.split(" ")[0]}.</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={sair} aria-label="Terminar sessão"><LogOut className="size-5" /></Button>
        </header>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="card-premium relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
            <div className="absolute -right-16 -top-16 size-44 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Saldo disponível</p>
                  <p className="mt-2 text-5xl font-light tracking-tight text-gold-gradient sm:text-6xl">{formatMZN(Number(cliente.saldo_atual))}</p>
                </div>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">{tier}</span>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Sparkles className="size-4 text-primary" />
                <span>Benefícios disponíveis para o nível {tier}</span>
              </div>
              <Recarga clienteId={cliente.id} />
            </div>
          </div>

          <VirtualCard cliente={cliente} cartao={cartaoQuery.data} active={cardActive} />
        </section>

        <Tabs defaultValue="historico" className="mt-7">
          <TabsList className="grid h-auto w-full grid-cols-3 bg-secondary p-1 sm:max-w-xl">
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="vantagens">Vantagens</TabsTrigger>
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
          </TabsList>

          <TabsContent value="historico" className="mt-5">
            <div className="card-premium rounded-3xl p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="text-xl">Movimentos</h2><p className="text-sm text-muted-foreground">Recargas e consumos do seu cartão.</p></div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={periodo} onValueChange={setPeriodo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7 dias</SelectItem><SelectItem value="30">30 dias</SelectItem><SelectItem value="90">90 dias</SelectItem><SelectItem value="todos">Tudo</SelectItem></SelectContent></Select>
                  <Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="recarga">Recargas</SelectItem><SelectItem value="consumo">Consumos</SelectItem><SelectItem value="desconto">Descontos</SelectItem></SelectContent></Select>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {transacoesQuery.data?.length ? transacoesQuery.data.map((t) => {
                  const entrada = t.tipo === "recarga";
                  return <div key={t.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/50 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${entrada ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>{entrada ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span>
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{t.descricao || (entrada ? "Recarga" : t.tipo === "desconto" ? "Desconto" : "Consumo")}</p><p className="text-xs text-muted-foreground">{new Date(t.timestamp).toLocaleString("pt-PT")}</p></div>
                    </div>
                    <div className="shrink-0 text-right"><p className={`text-sm font-medium ${entrada ? "text-success" : ""}`}>{entrada ? "+" : "−"} {formatMZN(Number(t.valor))}</p><p className="text-xs text-muted-foreground">Saldo {formatMZN(Number(t.saldo_apos))}</p></div>
                  </div>;
                }) : <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Não existem transações neste período.</p>}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vantagens" className="mt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {(vantagensQuery.data ?? []).map((v) => <div key={v.id} className="card-premium rounded-3xl p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-5" /></span><div><h3 className="text-lg">{v.nome}</h3><p className="text-xs uppercase tracking-wider text-primary">{v.tipo_desconto}</p></div></div><p className="mt-4 text-sm text-muted-foreground">{v.descricao || "Benefício disponível para o seu nível."}</p><p className="mt-4 text-xl text-gold-gradient">{v.valor_desconto}%</p></div>)}
              {!vantagensQuery.data?.length && <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">Não há vantagens configuradas para o seu nível.</div>}
            </div>
          </TabsContent>

          <TabsContent value="perfil" className="mt-5">
            <Perfil cliente={cliente} open={editar} setOpen={setEditar} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function VirtualCard({ cliente, cartao, active }: { cliente: Cliente; cartao?: Cartao; active: boolean }) {
  return <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-[#234701] via-[#183c12] to-[#102d1c] p-6 shadow-xl sm:p-7">
    <div className="absolute -right-10 -top-10 size-36 rounded-full border border-primary/10" /><div className="absolute -bottom-20 -left-10 size-44 rounded-full bg-primary/10 blur-2xl" />
    <div className="relative">
      <div className="flex items-center justify-between"><p className="text-xs uppercase tracking-[0.3em] text-primary/90">Villa Card Rewards</p><WalletCards className="size-6 text-primary" /></div>
      <div className="mt-9 h-11 w-14 rounded-xl border border-primary/40 bg-gradient-to-br from-primary/40 to-primary/10 shadow-inner"><div className="grid h-full place-items-center"><span className="size-7 rounded-md border border-primary/50" /></div></div>
      <p className="mt-7 text-lg font-medium tracking-[0.12em] text-white">{cartao?.codigo_nfc ? `•••• •••• ${cartao.codigo_nfc.slice(-4).toUpperCase()}` : "CARTÃO NÃO ASSOCIADO"}</p>
      <div className="mt-5 flex items-end justify-between"><div><p className="text-[0.6rem] uppercase text-white/50">Titular</p><p className="text-sm text-white">{cliente.nome}</p></div><span className={`rounded-full px-2.5 py-1 text-[0.65rem] uppercase ${active ? "bg-success/15 text-success" : "bg-white/10 text-white/60"}`}>{cartao?.estado ?? "sem cartão"}</span></div>
    </div>
  </div>;
}

function Recarga({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient(); const [open, setOpen] = useState(false); const [valor, setValor] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const amount = Number(valor);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Introduza um valor válido.");
      const { data: c, error: ce } = await supabase.from("clientes").select("saldo_atual").eq("id", clienteId).single();
      if (ce) throw ce;
      const novoSaldo = Number(c.saldo_atual) + amount;
      const { error: ue } = await supabase.from("clientes").update({ saldo_atual: novoSaldo }).eq("id", clienteId);
      if (ue) throw ue;
      const { error: te } = await supabase.from("transacoes").insert({ cliente_id: clienteId, tipo: "recarga", valor: amount, saldo_apos: novoSaldo, descricao: "Recarga simulada" });
      if (te) throw te;
    },
    onSuccess: () => { toast.success("Recarga simulada com sucesso."); setValor(""); setOpen(false); qc.invalidateQueries({ queryKey: ["cliente"] }); qc.invalidateQueries({ queryKey: ["transacoes"] }); },
    onError: (e: Error) => toast.error("Não foi possível recarregar", { description: e.message }),
  });
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="surface-gold mt-6 w-full sm:w-auto"><Plus className="size-4" /> Recarregar saldo</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Recarregar saldo</DialogTitle><DialogDescription>Simulação de pagamento. Nenhuma cobrança real será efectuada.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="recarga">Valor (MZN)</Label><Input id="recarga" type="number" min="1" step="1" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="500" /></div><DialogFooter><Button className="surface-gold w-full" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "A processar…" : "Confirmar recarga"}</Button></DialogFooter></DialogContent></Dialog>;
}

function Perfil({ cliente, open, setOpen }: { cliente: Cliente; open: boolean; setOpen: (v: boolean) => void }) {
  const qc = useQueryClient(); const [nome, setNome] = useState(cliente.nome); const [contacto, setContacto] = useState(cliente.contacto ?? "");
  const mutation = useMutation({ mutationFn: async () => { const { error } = await supabase.from("clientes").update({ nome, contacto: contacto || null }).eq("id", cliente.id); if (error) throw error; }, onSuccess: () => { toast.success("Perfil actualizado."); setOpen(false); qc.invalidateQueries({ queryKey: ["cliente"] }); }, onError: (e: Error) => toast.error("Erro ao actualizar perfil", { description: e.message }) });
  return <div className="card-premium max-w-2xl rounded-3xl p-5 sm:p-7"><div className="flex items-center justify-between"><div><h2 className="text-xl">Os meus dados</h2><p className="text-sm text-muted-foreground">Actualize o seu contacto quando necessário.</p></div><Button variant="outline" onClick={() => setOpen(!open)}><Pencil className="mr-2 size-4" /> Editar</Button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Nome</p><p className="mt-1 font-medium">{cliente.nome}</p></div><div><p className="text-xs text-muted-foreground">Email</p><p className="mt-1 font-medium">{cliente.email || "—"}</p></div><div><p className="text-xs text-muted-foreground">Contacto</p><p className="mt-1 font-medium">{cliente.contacto || "Não definido"}</p></div><div><p className="text-xs text-muted-foreground">Membro desde</p><p className="mt-1 font-medium">{new Date(cliente.data_registo).toLocaleDateString("pt-PT")}</p></div></div>{open && <form className="mt-6 space-y-4 border-t border-border pt-6" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}><div className="space-y-2"><Label htmlFor="perfil-nome">Nome</Label><Input id="perfil-nome" value={nome} onChange={(e) => setNome(e.target.value)} required /></div><div className="space-y-2"><Label htmlFor="perfil-contacto">Contacto</Label><Input id="perfil-contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="+258 84 000 0000" /></div><Button type="submit" className="surface-gold w-full" disabled={mutation.isPending}>{mutation.isPending ? "A guardar…" : "Guardar alterações"}</Button></form>}</div>;
}
