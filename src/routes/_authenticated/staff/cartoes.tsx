import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeitorCartao } from "@/components/LeitorCartao";
import { formatMZN } from "@/lib/format";
import { useStaff } from "./route";
import { CreditCard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/cartoes")({
  head: () => ({
    meta: [
      { title: "Associar cartões NFC · Villa Card" },
      {
        name: "description",
        content: "Associação de cartões físicos NFC às contas dos clientes do resort.",
      },
      { property: "og:title", content: "Associar cartões NFC · Villa Card" },
      {
        property: "og:description",
        content: "Associação de cartões físicos NFC às contas dos clientes do resort.",
      },
    ],
  }),
  component: Cartoes,
});

function Cartoes() {
  const queryClient = useQueryClient();
  const { data: staff } = useStaff();
  const [procura, setProcura] = useState("");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  const clientes = useQuery({
    queryKey: ["clientes-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_completo, telefone, saldo, nfc_uid, ativo")
        .order("nome_completo");
      if (error) throw error;
      return data;
    },
  });

  const lista = useMemo(() => {
    const termo = procura.trim().toLowerCase();
    return (clientes.data ?? []).filter(
      (c) =>
        !termo ||
        c.nome_completo.toLowerCase().includes(termo) ||
        (c.telefone ?? "").includes(termo),
    );
  }, [clientes.data, procura]);

  const cliente = lista.find((c) => c.id === seleccionado) ?? null;

  const associar = useMutation({
    mutationFn: async () => {
      if (!cliente || !uid) throw new Error("Seleccione um cliente e leia um cartão.");
      const normalizado = uid.toUpperCase();
      const { data: existente, error: erroProcura } = await supabase
        .from("clientes")
        .select("id, nome_completo")
        .eq("nfc_uid", normalizado)
        .maybeSingle();
      if (erroProcura) throw erroProcura;
      if (existente && existente.id !== cliente.id) {
        throw new Error(`Este cartão já está associado a ${existente.nome_completo}.`);
      }
      const { error } = await supabase
        .from("clientes")
        .update({ nfc_uid: normalizado })
        .eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cartão associado com sucesso");
      setUid(null);
      queryClient.invalidateQueries({ queryKey: ["clientes-admin"] });
    },
    onError: (e: Error) => toast.error("Associação não concluída", { description: e.message }),
  });

  if (staff && staff.cargo !== "administrador") {
    return (
      <p className="mt-10 rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
        Apenas administradores podem associar cartões.
      </p>
    );
  }

  return (
    <main className="mt-6 grid gap-6 md:grid-cols-2">
      <section>
        <h2 className="text-xl">1. Escolher o cliente</h2>
        <Input
          className="mt-3"
          placeholder="Procurar por nome ou telefone"
          value={procura}
          onChange={(e) => setProcura(e.target.value)}
        />
        <ul className="mt-4 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
          {lista.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSeleccionado(c.id)}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                  seleccionado === c.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card/60 hover:bg-card"
                }`}
              >
                <p className="text-sm">{c.nome_completo}</p>
                <p className="text-xs text-muted-foreground">
                  {c.telefone ?? "Sem telefone"} · {formatMZN(c.saldo)} ·{" "}
                  {c.nfc_uid ? `Cartão ${c.nfc_uid}` : "Sem cartão"}
                </p>
              </button>
            </li>
          ))}
          {!lista.length && (
            <li className="rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </li>
          )}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl">2. Associar o cartão</h2>
        {cliente ? (
          <>
            <LeitorCartao
              comQR={false}
              titulo="Aproximar cartão do leitor"
              descricao={`Cartão a associar a ${cliente.nome_completo}.`}
              onLeitura={(l) => setUid(l.valor.toUpperCase())}
            />
            <div className="rounded-2xl border border-border p-4">
              <p className="text-sm text-muted-foreground">
                UID lido:{" "}
                <span className="text-foreground">{uid ?? "— aguardando leitura —"}</span>
              </p>
              {cliente.nfc_uid && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Cliente já tem o cartão {cliente.nfc_uid}. Confirmar substitui-o.
                </p>
              )}
              <Button
                className="surface-gold mt-4 w-full"
                disabled={!uid || associar.isPending}
                onClick={() => associar.mutate()}
              >
                <CreditCard className="size-4" />
                {associar.isPending ? "A associar…" : "Confirmar associação"}
              </Button>
            </div>
          </>
        ) : (
          <p className="rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
            Seleccione primeiro um cliente na lista.
          </p>
        )}
      </section>
    </main>
  );
}
