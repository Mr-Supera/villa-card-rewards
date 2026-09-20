import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ScannerQR({
  aberto,
  onFechar,
  onLido,
}: {
  aberto: boolean;
  onFechar: () => void;
  onLido: (valor: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    let scanner: { stop: () => void; destroy: () => void } | null = null;

    (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelado || !videoRef.current) return;
        const instancia = new QrScanner(
          videoRef.current,
          (resultado) => {
            onLido(resultado.data.trim());
            onFechar();
          },
          { highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5 },
        );
        scanner = instancia;
        await instancia.start();
      } catch {
        if (!cancelado) setErro("Não foi possível aceder à câmara deste dispositivo.");
      }
    })();

    return () => {
      cancelado = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [aberto, onFechar, onLido]);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escanear QR Code</DialogTitle>
          <DialogDescription>
            Aponte a câmara ao código QR pessoal apresentado pelo cliente.
          </DialogDescription>
        </DialogHeader>
        {erro ? (
          <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            {erro}
          </p>
        ) : (
          <video ref={videoRef} className="w-full rounded-2xl border border-border" muted playsInline />
        )}
      </DialogContent>
    </Dialog>
  );
}
