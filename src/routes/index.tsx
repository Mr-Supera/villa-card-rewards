import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/resort-hero.jpg";
import { Button } from "@/components/ui/button";
import { CreditCard, Gift, QrCode, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Villa Card · Villa das Palmeiras" },
      {
        name: "description",
        content:
          "O cartão de fidelidade do resort Villa das Palmeiras, em Maputo. Recarregue saldo, suba de nível e aproveite vantagens exclusivas.",
      },
      { property: "og:title", content: "Villa Card · Villa das Palmeiras" },
      {
        property: "og:description",
        content:
          "O cartão de fidelidade do resort Villa das Palmeiras, em Maputo. Recarregue saldo, suba de nível e aproveite vantagens exclusivas.",
      },
    ],
  }),
  component: Landing,
});

const vantagens = [
  { icon: CreditCard, titulo: "Saldo pré-pago", texto: "Recarregue e pague em todo o resort com um só cartão." },
  { icon: Sparkles, titulo: "Níveis de fidelidade", texto: "Bronze, Prata, Ouro e Platina, com descontos crescentes." },
  { icon: Gift, titulo: "Vantagens exclusivas", texto: "Brindes, zonas VIP e experiências no zoo da Villa." },
  { icon: QrCode, titulo: "Cartão NFC e QR", texto: "Identifique-se com o cartão físico ou com o seu QR pessoal." },
];

function Landing() {
  return (
    <main className="min-h-screen">
      <section className="relative isolate overflow-hidden">
        <img
          src={heroImg}
          alt="Resort Villa das Palmeiras ao pôr do sol"
          width={1600}
          height={1008}
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 py-28 text-center sm:py-36">
          <p className="text-xs uppercase tracking-[0.4em] text-primary">
            Villa das Palmeiras · Maputo
          </p>
          <h1 className="mt-4 text-5xl leading-tight text-gold-gradient sm:text-7xl">Villa Card</h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            O cartão de fidelidade do resort. Saldo, descontos e vantagens exclusivas na palma da
            sua mão.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="surface-gold">
              <Link to="/auth">Criar conta / Entrar</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-2">
        {vantagens.map(({ icon: Icon, titulo, texto }) => (
          <div key={titulo} className="card-premium rounded-2xl p-6">
            <Icon className="size-6 text-primary" />
            <h2 className="mt-4 text-2xl">{titulo}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{texto}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
