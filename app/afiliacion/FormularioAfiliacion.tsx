"use client";

import { useActionState, useEffect } from "react";
import { Afiliacion } from "@/components/pantallas/Afiliacion";
import type { Asesor } from "@/lib/afiliacion/asesores";
import type { Grado } from "@/lib/mock";
import {
  esquemaAfiliacion,
  leerFormularioAfiliacion,
  valoresDeTextoAfiliacion,
  type CampoAfiliacion,
} from "@/lib/validaciones/afiliacion";
import { erroresPorCampo } from "@/lib/validaciones/comunes";
import { enviarAfiliacion, type EstadoAfiliacion } from "./actions";

const ESTADO_INICIAL: EstadoAfiliacion = {};

/** Conecta /afiliacion con su Server Action: validación previa, carga, errores y foco. */
export function FormularioAfiliacion({ grados, asesores }: { grados: Grado[]; asesores: Asesor[] }) {
  const [estado, accion, enviando] = useActionState(
    async (previo: EstadoAfiliacion, formData: FormData): Promise<EstadoAfiliacion> => {
      // Mismo esquema zod que el servidor: si algo falla, no se envía (ni se suben las fotos).
      const entrada = leerFormularioAfiliacion(formData);
      const local = esquemaAfiliacion.safeParse(entrada);
      if (!local.success) {
        return {
          errores: erroresPorCampo<CampoAfiliacion>(local.error),
          valores: valoresDeTextoAfiliacion(entrada),
        };
      }
      return enviarAfiliacion(previo, formData);
    },
    ESTADO_INICIAL,
  );

  // Foco al primer campo con error (en el orden en que aparecen en pantalla).
  useEffect(() => {
    if (estado.errores && Object.keys(estado.errores).length > 0) {
      document.querySelector<HTMLElement>('form [aria-invalid="true"]')?.focus();
    }
  }, [estado]);

  return (
    <Afiliacion
      grados={grados}
      asesores={asesores}
      accion={accion}
      cargando={enviando}
      errores={estado.errores}
      errorGeneral={estado.errorGeneral}
      valores={estado.valores}
    />
  );
}
