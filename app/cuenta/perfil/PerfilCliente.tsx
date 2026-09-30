"use client";

import { useActionState, useEffect } from "react";
import { Perfil, type PerfilProps } from "@/components/pantallas/Perfil";
import { esquemaTelefono } from "@/lib/validaciones/perfil";
import { actualizarTelefono, cerrarSesion, type EstadoTelefono } from "../actions";
import { pedirRenovacion, pedirRetiroAnticipado } from "../actions-proceso";

type Props = Omit<
  PerfilProps,
  "accionTelefono" | "accionSalir" | "errorTelefono" | "guardandoTelefono" | "mensajeTelefono" | "accionRetiro" | "accionRenovacion"
>;

/** Conecta /cuenta/perfil con «Guardar» (Mis datos), retiro anticipado, renovación y «Salir». */
export function PerfilCliente(props: Props) {
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
    <Perfil
      {...props}
      telefono={estado.telefono ?? props.telefono}
      errorTelefono={estado.error}
      guardandoTelefono={guardando}
      mensajeTelefono={estado.mensaje}
      accionTelefono={accionTelefono}
      accionSalir={cerrarSesion}
      accionRetiro={pedirRetiroAnticipado}
      accionRenovacion={pedirRenovacion}
    />
  );
}
