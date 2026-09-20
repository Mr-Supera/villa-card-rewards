import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScannerQR } from "@/components/ScannerQR";
import { Keyboard, QrCode, Radio } from "lucide-react";

export type LeituraCartao = { tipo: "nfc" | "qr"; valor: string };

/**
 * Campo de leitura de cartão para o balcão.
 * O leitor USB (ex.: ACR122U em modo HID) escreve o UID como texto e termina
 * com Enter — o campo recebe foco automaticamente e dispara a identificação.
 */
export function LeitorCartao({
  onLeitura,
  ocupado = false,
  comQR = true,
  titulo = "Aproxime o cartão do leitor",
  descricao = "O UID é lido automaticamente assim que o cartão toca no leitor.",
}: {
  onLeitura: (leitura: LeituraCartao) => void;
  ocupado?: boolean;
  comQR?: boolean;
  titulo?: string;
  descricao?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [valor, setValor] = useState("");
  const [manual, setManual] = useState(false);
  const [scanner, setScanner] = useState(false);

  useEffect(() => {
    if (!scanner) inputRef.current?.focus();
  }, [scanner]);

  function submeter(tipo: "nfc" | "qr", texto: string) {
    const limpo = texto.trim();
    if (!limpo) return;
    onLeitura({ tipo, valor: limpo });
    setValor("");
  }

  return (
    <div className="card-premium rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-primary/15 text-primary">
          <Radio className="size-5" />
        </span>
        <div>
          <h2 className="text-xl">{titulo}</h2>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>

      <form
        className="mt-5 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submeter("nfc", valor);
        }}
      >
        <Label htmlFor="uid-cartao" className={manual ? "" : "sr-only"}>
          UID do cartão
        </Label>
        <Input
          id="uid-cartao"
          ref={inputRef}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          disabled={ocupado}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={() => {
            if (!manual && !scanner) setTimeout(() => inputRef.current?.focus(), 120);
          }}
          placeholder={manual ? "Ex.: 04A2B1C3D4" : "À espera da leitura do cartão…"}
          className="h-14 text-center text-lg tracking-[0.25em] uppercase"
        />

        {manual && (
          <Button type="submit" className="surface-gold w-full" disabled={!valor || ocupado}>
            Procurar cliente
          </Button>
        )}
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setManual((m) => !m)}>
          <Keyboard className="size-4" />
          {manual ? "Voltar ao modo leitor" : "Inserir UID manualmente"}
        </Button>
        {comQR && (
          <Button type="button" variant="outline" size="sm" onClick={() => setScanner(true)}>
            <QrCode className="size-4" /> Escanear QR Code
          </Button>
        )}
      </div>

      {comQR && (
        <ScannerQR
          aberto={scanner}
          onFechar={() => setScanner(false)}
          onLido={(v) => submeter("qr", v)}
        />
      )}
    </div>
  );
}
