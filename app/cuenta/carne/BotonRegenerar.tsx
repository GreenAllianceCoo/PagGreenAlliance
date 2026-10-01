"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { regenerarCodigoCarne, type EstadoRegenerar } from "./actions";

/** Regenerar el código del QR: deshabilitado mientras envía, con aviso para lectores de pantalla. */
export function BotonRegenerar() {
  const [estado, accion, pendiente] = useActionState<EstadoRegenerar, FormData>(
    () => regenerarCodigoCarne(),
    {},
  );
  return (
    <form action={accion} className="flex flex-col gap-2">
      <Button type="submit" variante="secundario" disabled={pendiente} cargando={pendiente} textoCargando="Regenerando…">
        Regenerar código
      </Button>
      <p role="status" aria-live="polite" className="m-0 text-13 text-ga-texto-2">
        {estado.error ?? (estado.ok ? "Listo: el código anterior ya no sirve." : "")}
      </p>
    </form>
  );
}
