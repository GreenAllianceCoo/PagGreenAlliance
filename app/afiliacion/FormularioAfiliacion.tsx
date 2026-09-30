"use client";

import { useActionState, useEffect } from "react";
import { Afiliacion } from "@/components/pantallas/Afiliacion";
import type { Asesor } from "@/lib/afiliacion/asesores";
import type { GradoCatalogo } from "@/lib/gradosCatalogo";
import { createClient } from "@/lib/supabase/client";
import {
  CAMPOS_FOTO,
  crearEsquemaDatosAfiliacion,
  esquemaArchivosAfiliacion,
  leerArchivosAfiliacion,
  leerTextoAfiliacion,
  type CampoAfiliacion,
  type CampoFoto,
  type TipoFotoPermitido,
} from "@/lib/validaciones/afiliacion";
import { erroresPorCampo } from "@/lib/validaciones/comunes";
import { enviarAfiliacion, prepararSubidaFotos, type EstadoAfiliacion } from "./actions";

const ESTADO_INICIAL: EstadoAfiliacion = {};
const MENSAJE_SUBIDA_FALLO = "No pudimos subir tus fotos. Revisa tu conexión e intenta de nuevo.";

/**
 * Conecta /afiliacion con sus Server Actions (spec-requerimientos-ricardo §2):
 *  1. valida el texto y las 3 fotos con el MISMO esquema zod del servidor;
 *  2. pide URLs firmadas (`prepararSubidaFotos`) y sube cada foto DIRECTO al
 *     bucket privado (`uploadToSignedUrl`), sin pasar por la Server Action;
 *  3. envía el formulario con las RUTAS + el ticket (`enviarAfiliacion`).
 * Mientras tanto `enviando` = true (botón deshabilitado, texto de carga).
 * Cada envío pide URLs nuevas: si algo falla, el servidor borra lo subido.
 *
 * Pieza 3j (institución → grado, cuenta de nómina, dos correos, verificador de foto y
 * selfie con cámara) maquetada en components/pantallas/Afiliacion.tsx.
 */
export function FormularioAfiliacion({ grados, asesores }: { grados: GradoCatalogo[]; asesores: Asesor[] }) {
  const esquemaDatos = crearEsquemaDatosAfiliacion({ grados, asesores });

  const [estado, accion, enviando] = useActionState(
    async (previo: EstadoAfiliacion, formData: FormData): Promise<EstadoAfiliacion> => {
      const texto = leerTextoAfiliacion(formData);
      const archivos = leerArchivosAfiliacion(formData);

      // 1. Validación local (texto + archivos) antes de subir nada.
      const localTexto = esquemaDatos.safeParse(texto);
      const localArchivos = esquemaArchivosAfiliacion.safeParse(archivos);
      if (!localTexto.success || !localArchivos.success) {
        return {
          errores: {
            ...(localTexto.success ? {} : erroresPorCampo<CampoAfiliacion>(localTexto.error)),
            ...(localArchivos.success ? {} : erroresPorCampo<CampoAfiliacion>(localArchivos.error)),
          },
          valores: texto,
        };
      }
      const fotos = localArchivos.data;
      const campos = Object.keys(CAMPOS_FOTO) as CampoFoto[];

      // 2. URLs firmadas + subida directa.
      const subidas = await prepararSubidaFotos(
        Object.fromEntries(campos.map((c) => [c, fotos[c].type as TipoFotoPermitido])),
      );
      if (!subidas.ok) return { errorGeneral: subidas.error, valores: texto };

      const almacenamiento = createClient().storage.from(subidas.bucket);
      const resultados = await Promise.all(
        campos.map((campo) =>
          almacenamiento.uploadToSignedUrl(subidas.fotos[campo].ruta, subidas.fotos[campo].token, fotos[campo], {
            contentType: fotos[campo].type,
          }),
        ),
      );
      const fallida = campos.find((_, i) => resultados[i].error);
      if (fallida) {
        return { errores: { [fallida]: MENSAJE_SUBIDA_FALLO }, valores: texto };
      }

      // 3. Envío final: texto + rutas + ticket (sin archivos).
      const envio = new FormData();
      for (const [clave, valor] of formData.entries()) {
        if (typeof valor === "string") envio.append(clave, valor);
      }
      for (const campo of campos) envio.set(campo, subidas.fotos[campo].ruta);
      envio.set("fotos_ticket", subidas.ticket);
      return enviarAfiliacion(previo, envio);
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
