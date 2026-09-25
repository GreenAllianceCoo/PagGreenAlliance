"use client";

import { useActionState, useEffect } from "react";
import { IngresoCedula } from "@/components/pantallas/IngresoCedula";
import { esquemaIngresoCedula } from "@/lib/validaciones/ingreso";
import { enviarCodigoIngreso, type EstadoIngresoCedula } from "./actions";

const ESTADO_INICIAL: EstadoIngresoCedula = {};

/** Conecta la pantalla /ingresar con su Server Action (estado, carga y foco). */
export function FormularioIngreso({ whatsapp, whatsappUrl }: { whatsapp: string; whatsappUrl: string | null }) {
  const [estado, accion, enviando] = useActionState(
    async (previo: EstadoIngresoCedula, formData: FormData) => {
      // Misma validación en el cliente para no viajar al servidor con un formato inválido.
      const cedula = String(formData.get("cedula") ?? "");
      const local = esquemaIngresoCedula.safeParse({ cedula });
      if (!local.success) return { error: local.error.issues[0]?.message, cedula };
      return enviarCodigoIngreso(previo, formData);
    },
    ESTADO_INICIAL,
  );

  // Foco al campo con error después de cada envío fallido.
  useEffect(() => {
    if (estado.error) document.getElementById("cedula")?.focus();
  }, [estado]);

  return (
    <IngresoCedula
      whatsapp={whatsapp}
      whatsappUrl={whatsappUrl}
      accion={accion}
      cargando={enviando}
      error={estado.error}
      valorCedula={estado.cedula}
    />
  );
}
