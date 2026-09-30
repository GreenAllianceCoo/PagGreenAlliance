/**
 * «Buscar cliente por cédula» del panel del asesor (spec-requerimientos-
 * ricardo §5.5, pieza 3l). Función pura sobre la fila de
 * public.buscar_cliente_asesor(): cédula ENMASCARADA, estado del proceso y
 * capacidad de endeudamiento (cupos 50 % y 100 % del grupo del grado, o
 * «sin cupo configurado»). Nunca contacto, nómina, fotos ni tasa.
 */

import { formatearPesos } from "@/lib/cuenta";
import { formatearFechaLarga } from "@/lib/fechas";
import { MENSAJE_SIN_CUPO, TEXTO_SIN_CUPO_CORTO } from "@/lib/gradosCatalogo";
import { enmascararCedula } from "@/lib/mascara";
import { esEstadoProceso, ETIQUETA_ESTADO_PROCESO, type EstadoProceso } from "@/lib/procesoEjecutivo";
import { nombreInstitucion } from "@/lib/validaciones/instituciones";

/** Texto cuando la cédula no es de un cliente suyo (misma respuesta exista o no la persona). */
export const MENSAJE_CLIENTE_NO_ENCONTRADO = "No encontramos un cliente tuyo con esa cédula.";

/** Fila de public.buscar_cliente_asesor(p_cedula). */
export type FilaClienteAsesor = {
  perfil_id: string;
  nombre: string;
  cedula: string;
  grado: string | null;
  grado_nombre: string | null;
  institucion: string | null;
  estado_proceso: string | null;
  fecha_inicio_embargo: string | null;
  grupo_credito: string | null;
  cupo_50: number | string | null;
  cupo_100: number | string | null;
};

export type ClienteBuscado = {
  perfilId: string;
  nombre: string;
  /** «1.0••.•••.321» (nunca la cédula completa en la respuesta). */
  cedulaEnmascarada: string;
  grado: string | null;
  institucion: string | null;
  estadoProceso: EstadoProceso | null;
  /** «Operando», o «Sin iniciar» si todavía no hay proceso. */
  estadoProcesoTexto: string;
  fechaInicioEmbargoTexto: string | null;
  capacidad:
    | { configurada: true; cupo50: string; cupo100: string }
    | { configurada: false; texto: string; mensaje: string };
};

export function vistaClienteBuscado(fila: FilaClienteAsesor): ClienteBuscado {
  const estado = esEstadoProceso(fila.estado_proceso) ? fila.estado_proceso : null;
  const configurada = fila.cupo_50 !== null && fila.cupo_100 !== null && fila.grupo_credito !== null;
  return {
    perfilId: fila.perfil_id,
    nombre: fila.nombre,
    cedulaEnmascarada: enmascararCedula(fila.cedula),
    grado: fila.grado_nombre ?? fila.grado,
    institucion: nombreInstitucion(fila.institucion),
    estadoProceso: estado,
    estadoProcesoTexto: estado ? ETIQUETA_ESTADO_PROCESO[estado] : "Sin iniciar",
    fechaInicioEmbargoTexto: fila.fecha_inicio_embargo ? formatearFechaLarga(fila.fecha_inicio_embargo) : null,
    capacidad: configurada
      ? { configurada: true, cupo50: formatearPesos(fila.cupo_50!), cupo100: formatearPesos(fila.cupo_100!) }
      : { configurada: false, texto: TEXTO_SIN_CUPO_CORTO, mensaje: MENSAJE_SIN_CUPO },
  };
}
