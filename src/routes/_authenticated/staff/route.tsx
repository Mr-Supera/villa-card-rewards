import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({
  component: LayoutStaff,
});

export function useStaff() {
  return useQuery({
    queryKey: ["staff-actual"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão inválida");
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("user_id", auth.user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function LayoutStaff() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: staff, isLoading } = useStaff();

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) {
    return <div className="p-10 text-center text-muted-foreground">A verificar credenciais…</div>;
  }

  if (!staff) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-2xl">Acesso reservado à equipa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta conta não pertence à equipa do resort. Contacte um administrador.
        </p>
        <Button className="mt-6" variant="outline" onClick={sair}>
          Terminar sessão
        </Button>
      </div>
    );
  }

  const admin = staff.cargo === "administrador";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.35em] text-primary">
            Villa das Palmeiras · Balcão
          </p>
          <h1 className="text-2xl">{staff.nome_completo}</h1>
          <p className="text-xs text-muted-foreground">
            {admin ? "Administrador" : "Operador de balcão"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/staff">Atendimento</Link>
          </Button>
          {admin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/staff/cartoes">Cartões</Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={sair} aria-label="Terminar sessão">
            <LogOut className="size-5" />
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
