import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { normalizarTelefone } from "@/lib/format";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · Villa Card" },
      {
        name: "description",
        content: "Aceda à sua conta Villa Card do resort Villa das Palmeiras.",
      },
      { property: "og:title", content: "Entrar · Villa Card" },
      {
        property: "og:description",
        content: "Aceda à sua conta Villa Card do resort Villa das Palmeiras.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    navigate({ to: "/painel", replace: true });
  }

  async function registar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Indique o seu nome completo");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/painel",
        data: {
          nome_completo: nome.trim(),
          telefone: telefone ? normalizarTelefone(telefone) : null,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível criar a conta", { description: error.message });
      return;
    }
    if (!data.session) {
      toast.success("Conta criada", {
        description: "Verifique o seu email para confirmar o registo.",
      });
      return;
    }
    navigate({ to: "/painel", replace: true });
  }

  async function entrarComGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Falha ao entrar com Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/painel", replace: true });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-primary">Villa das Palmeiras</p>
        <h1 className="mt-2 text-4xl text-gold-gradient">Villa Card</h1>
      </Link>

      <div className="card-premium w-full max-w-md rounded-3xl p-6 sm:p-8">
        <Tabs defaultValue="entrar">
          <TabsList className="grid w-full grid-cols-2 bg-secondary">
            <TabsTrigger value="entrar">Entrar</TabsTrigger>
            <TabsTrigger value="registar">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="entrar">
            <form onSubmit={entrar} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@exemplo.co.mz"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Palavra-passe</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full surface-gold">
                {loading ? "A entrar…" : "Entrar"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="registar">
            <form onSubmit={registar} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone (Moçambique)</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="+258 84 000 0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-r">Email</Label>
                <Input
                  id="email-r"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-r">Palavra-passe</Label>
                <Input
                  id="password-r"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full surface-gold">
                {loading ? "A criar…" : "Criar conta"}
              </Button>
              <p className="text-xs text-muted-foreground">
                O cartão físico com chip NFC é associado depois, presencialmente, na recepção do
                resort.
              </p>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={entrarComGoogle}>
          Continuar com Google
        </Button>
      </div>
    </main>
  );
}
