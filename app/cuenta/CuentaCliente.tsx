"use client";

import { useActionState, useEffect } from "react";
import { Cuenta, type CuentaProps } from "@/components/pantallas/Cuenta";
import { esquemaTelefono } from "@/lib/validaciones/perfil";
import { actualizarTelefono, cerrarSesion, type EstadoTelefono } from "./actions";

type Props = Omit<
  CuentaProps,
  "accionTelefono" | "accionSalir" | "errorTelefono" | "guardandoTelefono" | "mensajeTelefono"
>;

/** Conecta /cuenta con «Guardar» (Mis datos) y «Salir». */
export function CuentaCliente(props: Props) {
  const [estado, accionTelefono, guardando] = useActionState(
    async (previo: EstadoTelefono, formData: FormData): Promise<EstadoTelefono> => {
      // Mismo esquema zod que el servidor.
      const telefono = String(formData.get("telefono") ?? "");
      const local = esquemaTelefono.safeParse({ telefono });
      if (!local.success) return { error: local.error.issues[0]?.message, telefono };
      return actualizarTelefono(previo, formData);
    },
    {},
  );

  // Foco al celular si hubo error.
  useEffect(() => {
    if (estado.error) document.getElementById("telefono")?.focus();
  }, [estado]);

  return (
    <Cuenta
      {...props}
      telefono={estado.telefono ?? props.telefono}
      errorTelefono={estado.error}
      guardandoTelefono={guardando}
      mensajeTelefono={estado.mensaje}
      accionTelefono={accionTelefono}
      accionSalir={cerrarSesion}
    />
  );
}
