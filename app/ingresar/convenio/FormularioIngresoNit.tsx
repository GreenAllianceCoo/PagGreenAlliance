"use client";

import { useActionState, useEffect } from "react";
import { IngresoNit } from "@/components/pantallas/IngresoNit";
import { esquemaIngresoNit } from "@/lib/validaciones/ingreso";
import { enviarCodigoConvenio, type EstadoIngresoNit } from "../actions";

const ESTADO_INICIAL: EstadoIngresoNit = {};

/** Conecta /ingresar/convenio con su Server Action (estado, carga y foco). */
export function FormularioIngresoNit({ whatsapp, whatsappUrl }: { whatsapp: string; whatsappUrl: string | null }) {
  const [estado, accion, enviando] = useActionState(
    async (previo: EstadoIngresoNit, formData: FormData) => {
      // Misma validación en el cliente para no viajar al servidor con un formato inválido.
      const nit = String(formData.get("nit") ?? "");
      const local = esquemaIngresoNit.safeParse({ nit });
      if (!local.success) return { error: local.error.issues[0]?.message, nit };
      return enviarCodigoConvenio(previo, formData);
    },
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (estado.error) document.getElementById("nit")?.focus();
  }, [estado]);

  return (
    <IngresoNit
      whatsapp={whatsapp}
      whatsappUrl={whatsappUrl}
      accion={accion}
      cargando={enviando}
      error={estado.error}
      valorNit={estado.nit}
    />
  );
}
