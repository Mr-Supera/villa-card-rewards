import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, CreditCard, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({ component: LayoutStaff });

export function useStaff() {
  return useQuery({
    queryKey: ["staff-actual"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão inválida");
      const { data, error } = await supabase.from("staff").select("*").eq("id", auth.user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function LayoutStaff() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: staff, isLoading, error } = useStaff();

  async function sair() {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">A verificar credenciais…</div>;
  if (error || !staff) return <div className="mx-auto max-w-md p-10 text-center"><h1 className="text-2xl">Acesso reservado à equipa</h1><p className="mt-2 text-sm text-muted-foreground">Esta conta não está registada como staff.</p><Button className="mt-6" variant="outline" onClick={sair}>Terminar sessão</Button></div>;

  const admin = ["admin", "administrador"].includes(String(staff.cargo).toLowerCase());

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div><p className="text-[0.65rem] uppercase tracking-[0.35em] text-primary">Villa das Palmeiras · Villa Card</p><h1 className="text-2xl">{staff.nome}</h1><p className="text-xs text-muted-foreground">{admin ? "Administrador" : "Staff"} · {staff.cargo}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/staff"><LayoutDashboard className="mr-2 size-4"/>Painel</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/staff/cartoes"><CreditCard className="mr-2 size-4"/>Cartões</Link></Button>
            <Button variant="ghost" size="icon" onClick={sair} aria-label="Terminar sessão"><LogOut className="size-5"/></Button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
