/**
 * Proceso ejecutivo y embargo solidario del asociado (spec-requerimientos-
 * ricardo §3.6–§3.9; migraciones 20260929100300 y 20260929100400).
 * Funciones puras: convierten la fila de `mi_proceso_ejecutivo()` en lo que
 * muestra /cuenta «Perfil» (pieza 3k). Las fechas y permisos los decide la
 * base; aquí solo se arman textos y la línea de pasos.
 */

import type { EstadoPaso } from "@/components/ui/PasosSolicitud";
import {
  formatearFechaLarga,
  formatearMesAnio,
  mesesYDiasEntre,
  textoMesesYDias,
  type FechaISO,
} from "@/lib/fechas";

/** Valores del enum public.estado_proceso_ejecutivo, en orden. */
export const ESTADOS_PROCESO = [
  "reparto",
  "admitido",
  "notificacion",
  "sentencia",
  "liquidacion",
  "entrega_titulos",
  "operando",
  "terminado",
] as const;
export type EstadoProceso = (typeof ESTADOS_PROCESO)[number];

export const ETIQUETA_ESTADO_PROCESO: Record<EstadoProceso, string> = {
  reparto: "Reparto",
  admitido: "Admitido",
  notificacion: "Notificación",
  sentencia: "Sentencia",
  liquidacion: "Liquidación",
  entrega_titulos: "Entrega de títulos",
  operando: "Operando",
  terminado: "Terminado",
};

export function esEstadoProceso(valor: unknown): valor is EstadoProceso {
  return typeof valor === "string" && (ESTADOS_PROCESO as readonly string[]).includes(valor);
}

/** Cifras de la presentación (spec §0). */
export const MESES_EMBARGO = 36;
export const MESES_HABILITA_RENOVACION = 24;
export const COBRO_RETIRO_ANTICIPADO = 10_000_000;
export const TEXTO_COBRO_RETIRO_ANTICIPADO = "$ 10.000.000";

export const TEXTO_ANTES_DE_OPERANDO = "Tu conteo de 36 meses empieza cuando tu proceso esté operando";
export const TEXTO_CONTEO_TERMINADO = "Tu conteo de 36 meses terminó";
export const TEXTO_SIN_PROCESO = "Tu proceso ejecutivo todavía no ha empezado";
export const MENSAJE_ALERTA_ENVIADA = "Listo, el administrador te contactará";

/** Fila de `public.mi_proceso_ejecutivo()` (0 o 1 fila). */
export type FilaMiProceso = {
  estado: EstadoProceso;
  fecha_inicio_embargo: FechaISO | null;
  fecha_fin_embargo: FechaISO | null;
  fecha_habilita_renovacion: FechaISO | null;
  conteo_activo: boolean;
  puede_pedir_retiro: boolean;
  puede_pedir_renovacion: boolean;
  retiro_pendiente: boolean;
  renovacion_pendiente: boolean;
};

export type PasoProceso = { clave: EstadoProceso; etiqueta: string; estado: EstadoPaso };

export type VistaProcesoEjecutivo = {
  /** false = el admin todavía no ha creado el proceso (sin fila). */
  tieneProceso: boolean;
  estado: EstadoProceso | null;
  estadoTexto: string;
  /** Los 8 pasos, siempre en el mismo orden. */
  pasos: PasoProceso[];
  /** Conteo de 36 meses (null antes de «Operando»). */
  conteo: {
    activo: boolean;
    fechaInicio: FechaISO;
    fechaInicioTexto: string;
    fechaFin: FechaISO;
    fechaFinTexto: string;
    mesesRestantes: number;
    diasRestantes: number;
    /** «30 meses y 12 días». */
    faltaTexto: string;
  } | null;
  /** Frase lista para mostrar bajo el título del conteo. */
  textoConteo: string;
  /** «Retiro anticipado» (R-05): visible en «Operando» con el conteo activo. */
  retiro: { visible: boolean; habilitado: boolean; pendiente: boolean };
  /** «Renovar los 36 meses» (R-06): visible con conteo; activo a los 24 meses. */
  renovacion: {
    visible: boolean;
    habilitado: boolean;
    pendiente: boolean;
    fechaHabilita: FechaISO | null;
    fechaHabilitaTexto: string | null;
    /** «Se activa en 3 meses y 2 días» mientras está desactivado (null si ya se puede). */
    faltaTexto: string | null;
  };
};

function pasosDe(estado: EstadoProceso | null): PasoProceso[] {
  const indice = estado ? ESTADOS_PROCESO.indexOf(estado) : -1;
  return ESTADOS_PROCESO.map((clave, i) => {
    let estadoPaso: EstadoPaso = "pendiente";
    if (estado === "terminado") estadoPaso = "hecho";
    else if (i < indice) estadoPaso = "hecho";
    else if (i === indice) estadoPaso = "actual";
    return { clave, etiqueta: ETIQUETA_ESTADO_PROCESO[clave], estado: estadoPaso };
  });
}

/** Vista del proceso para /cuenta. `hoy` en hora de Colombia (lib/fechas.ts → hoyBogota()). */
export function vistaProcesoEjecutivo(fila: FilaMiProceso | null, hoy: FechaISO): VistaProcesoEjecutivo {
  if (!fila || !esEstadoProceso(fila.estado)) {
    return {
      tieneProceso: false,
      estado: null,
      estadoTexto: "Sin iniciar",
      pasos: pasosDe(null),
      conteo: null,
      textoConteo: TEXTO_ANTES_DE_OPERANDO,
      retiro: { visible: false, habilitado: false, pendiente: false },
      renovacion: {
        visible: false,
        habilitado: false,
        pendiente: false,
        fechaHabilita: null,
        fechaHabilitaTexto: null,
        faltaTexto: null,
      },
    };
  }

  const operando = fila.estado === "operando";
  const inicio = fila.fecha_inicio_embargo;
  const fin = fila.fecha_fin_embargo;

  let conteo: VistaProcesoEjecutivo["conteo"] = null;
  if (inicio && fin) {
    const restante = mesesYDiasEntre(hoy, fin);
    conteo = {
      activo: fila.conteo_activo,
      fechaInicio: inicio,
      fechaInicioTexto: formatearFechaLarga(inicio),
      fechaFin: fin,
      fechaFinTexto: formatearFechaLarga(fin),
      mesesRestantes: restante.meses,
      diasRestantes: restante.dias,
      faltaTexto: textoMesesYDias(restante),
    };
  }

  let textoConteo = TEXTO_ANTES_DE_OPERANDO;
  if (conteo && conteo.activo) textoConteo = `Faltan ${conteo.faltaTexto}`;
  else if (conteo) textoConteo = TEXTO_CONTEO_TERMINADO;

  const habilita = fila.fecha_habilita_renovacion;
  const faltaRenovacion =
    habilita && !fila.puede_pedir_renovacion && !fila.renovacion_pendiente && operando
      ? mesesYDiasEntre(hoy, habilita)
      : null;

  return {
    tieneProceso: true,
    estado: fila.estado,
    estadoTexto: ETIQUETA_ESTADO_PROCESO[fila.estado],
    pasos: pasosDe(fila.estado),
    conteo,
    textoConteo,
    retiro: {
      // TODO(confirmar: R-05) visible desde «Operando» y mientras el conteo esté activo.
      visible: operando && fila.conteo_activo,
      habilitado: fila.puede_pedir_retiro,
      pendiente: fila.retiro_pendiente,
    },
    renovacion: {
      // TODO(confirmar: R-06) visible con conteo; se activa a los 24 meses.
      visible: operando && conteo !== null,
      habilitado: fila.puede_pedir_renovacion,
      pendiente: fila.renovacion_pendiente,
      fechaHabilita: habilita,
      fechaHabilitaTexto: habilita ? formatearFechaLarga(habilita) : null,
      faltaTexto:
        faltaRenovacion && (faltaRenovacion.meses > 0 || faltaRenovacion.dias > 0)
          ? `Se activa en ${textoMesesYDias(faltaRenovacion)}`
          : null,
    },
  };
}

/**
 * Datos para la tarjeta existente «Tu camino a la estabilidad» del carné
 * (prop `caminoEstabilidad` de components/pantallas/Cuenta.tsx): mes en curso
 * del embargo (1-based, máx. 36). Solo con conteo; si no, undefined (la
 * tarjeta no se dibuja: no se inventan fechas).
 */
export function caminoEstabilidad(
  vista: VistaProcesoEjecutivo,
  hoy: FechaISO,
): { mesActual: number; totalMeses: number; fechaInicio: string; fechaFin: string } | undefined {
  if (!vista.conteo) return undefined;
  const transcurrido = mesesYDiasEntre(vista.conteo.fechaInicio, hoy);
  return {
    mesActual: Math.min(MESES_EMBARGO, Math.max(1, transcurrido.meses + 1)),
    totalMeses: MESES_EMBARGO,
    fechaInicio: formatearMesAnio(vista.conteo.fechaInicio),
    fechaFin: formatearMesAnio(vista.conteo.fechaFin),
  };
}
