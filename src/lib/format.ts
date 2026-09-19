export function formatMZN(valor: number | string | null | undefined): string {
  const n = Number(valor ?? 0);
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + " MZN";
}

export function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function normalizarTelefone(input: string): string {
  const limpo = input.replace(/[^\d+]/g, "");
  if (limpo.startsWith("+258")) return limpo;
  if (limpo.startsWith("258")) return "+" + limpo;
  return "+258" + limpo.replace(/^0+/, "");
}
