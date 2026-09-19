import { Crown } from "lucide-react";

export function NivelBadge({
  nome,
  cor,
  desconto,
}: {
  nome: string | null | undefined;
  cor?: string | null;
  desconto?: number | string | null;
}) {
  const corFinal = cor ?? "#d4af37";
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-widest"
      style={{
        borderColor: corFinal,
        color: corFinal,
        backgroundColor: `${corFinal}1a`,
      }}
    >
      <Crown className="size-3.5" />
      {nome ?? "Sem nível"}
      {desconto != null && <span>· {Number(desconto)}%</span>}
    </span>
  );
}
