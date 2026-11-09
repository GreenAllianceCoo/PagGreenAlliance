/**
 * Texto en lenguaje claro de cada fila de public.admin_cambios_asociados() (función pura,
 * sin acceso a la base): «Cambió el celular: 300 111 2233 → 311 444 5566».
 */
import { formatearCuandoEquipo } from "@/lib/admin/historialEquipoTexto";
import { ETIQUETA_FOTO_AFILIACION, esCampoFoto } from "@/lib/fotosAfiliacionAdmin";
import { ETIQUETA_ESTADO_PROCESO, esEstadoProceso } from "@/lib/procesoEjecutivo";

/** Fila tal como la devuelve la RPC. */
export type FilaCambioAsociado = {
  id: string;
  cuando: string;
  asociado_id: string;
  asociado_nombre: string;
  actor_nombre: string | null;
  actor_rol: string | null;
  tipo: string;
  detalle: Record<string, unknown> | null;
  motivo: string | null;
  total: number | string;
};

/** Un dato que cambió, con su valor anterior y el nuevo («—» si estaba vacío). */
export type LineaCambio = { etiqueta: string; antes: string; despues: string };

export type CambioAsociado = {
  id: string;
  /** «8 nov 2026 10:15» (hora de Colombia). */
  cuando: string;
  cuandoISO: string;
  asociadoId: string;
  asociadoNombre: string;
  /** «Ana Pérez (administrador)» o «El asociado». */
  autor: string;
  /** «Cambió los datos personales». */
  titulo: string;
  lineas: LineaCambio[];
  motivo: string | null;
  /** Solo en cambios de foto de afiliación: rutas «bucket/ruta» (el servidor las cambia por URLs firmadas). */
  foto: { etiqueta: string; rutaAnterior: string | null; rutaNueva: string | null } | null;
};

const NOMBRE_ROL: Record<string, string> = {
  admin: "administrador",
  secretario: "secretario",
  asesor: "asesor",
  asociado: "asociado",
};

const ETIQUETA_DATO: Record<string, string> = {
  nombre: "Nombre",
  celular: "Celular",
  correo_institucional: "Correo institucional",
  nomina_entidad: "Entidad de nómina",
  nomina_tipo: "Tipo de cuenta de nómina",
  nomina_numero: "Número de cuenta de nómina",
  cedula: "Cédula",
};
const ORDEN_DATOS = Object.keys(ETIQUETA_DATO);

const texto = (v: unknown): string => (v === null || v === undefined || v === "" ? "—" : String(v));
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fechaCorta(v: unknown): string | null {
  const m = typeof v === "string" ? v.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : null;
}

function etiquetaProceso(v: unknown): string {
  return typeof v === "string" && esEstadoProceso(v) ? ETIQUETA_ESTADO_PROCESO[v] : texto(v);
}

/** Antes/después de los datos (solo los que cambiaron, en un orden fijo). */
function lineasDatos(detalle: Record<string, unknown>): LineaCambio[] {
  const antes = objeto(detalle.antes);
  const despues = objeto(detalle.despues);
  const claves = ORDEN_DATOS.filter((k) => k in antes || k in despues);
  return claves.map((k) => ({ etiqueta: ETIQUETA_DATO[k], antes: texto(antes[k]), despues: texto(despues[k]) }));
}

/** Campos cambiados cuando la fila es de antes de guardar valores (solo los nombres). */
function camposSinValores(detalle: Record<string, unknown>): string {
  const campos = Array.isArray(detalle.campos) ? (detalle.campos as unknown[]).map(String) : [];
  const nombres = campos.map((c) => (c === "nomina" ? "cuenta de nómina" : (ETIQUETA_DATO[c] ?? c).toLowerCase()));
  return nombres.length ? nombres.join(", ") : "datos";
}

export function vistaCambio(f: FilaCambioAsociado): CambioAsociado {
  const d = objeto(f.detalle);
  const autor = f.actor_nombre
    ? f.tipo === "foto_carne"
      ? "El asociado"
      : `${f.actor_nombre}${f.actor_rol && NOMBRE_ROL[f.actor_rol] ? ` (${NOMBRE_ROL[f.actor_rol]})` : ""}`
    : "Sistema";
  const base = {
    id: f.id,
    cuando: formatearCuandoEquipo(f.cuando),
    cuandoISO: f.cuando,
    asociadoId: f.asociado_id,
    asociadoNombre: f.asociado_nombre,
    autor,
    motivo: f.motivo,
    lineas: [] as LineaCambio[],
    foto: null as CambioAsociado["foto"],
  };

  switch (f.tipo) {
    case "datos": {
      const lineas = lineasDatos(d);
      return lineas.length
        ? { ...base, titulo: "Cambió los datos personales", lineas }
        : { ...base, titulo: `Cambió ${camposSinValores(d)} (registro sin valores)` };
    }
    case "cedula": {
      const lineas = lineasDatos(d);
      return lineas.length ? { ...base, titulo: "Corrigió la cédula", lineas } : { ...base, titulo: "Corrigió la cédula (registro sin valores)" };
    }
    case "foto_afiliacion": {
      const campo = typeof d.campo === "string" && esCampoFoto(d.campo) ? d.campo : null;
      const etiqueta = campo ? ETIQUETA_FOTO_AFILIACION[campo] : "Foto";
      return {
        ...base,
        titulo: `Cambió la foto: ${etiqueta.toLowerCase()}`,
        foto: {
          etiqueta,
          rutaAnterior: typeof d.ruta_anterior === "string" ? d.ruta_anterior : null,
          rutaNueva: typeof d.ruta_nueva === "string" ? d.ruta_nueva : null,
        },
      };
    }
    case "foto_carne":
      return {
        ...base,
        titulo: d.accion === "quitada" ? "Volvió a la selfie de afiliación en su carné" : "Cambió la foto de su carné",
      };
    case "correo_ingreso":
      return { ...base, titulo: "Cambió el correo de ingreso" };
    case "asesor":
      return { ...base, titulo: "Cambió el asesor", lineas: [{ etiqueta: "Asesor", antes: texto(d.anterior), despues: texto(d.nuevo) }] };
    case "estado":
      return { ...base, titulo: d.activo === true ? "Reactivó al asociado" : "Dio de baja al asociado" };
    case "proceso": {
      const fecha = fechaCorta(d.fecha_inicio_embargo);
      return {
        ...base,
        titulo: "Cambió el proceso ejecutivo",
        lineas: [
          { etiqueta: "Estado", antes: etiquetaProceso(d.anterior), despues: etiquetaProceso(d.nuevo) },
          ...(fecha ? [{ etiqueta: "Inicio del embargo", antes: "—", despues: fecha }] : []),
        ],
      };
    }
    case "documento_subido":
      return { ...base, titulo: `Subió el documento «${texto(d.nombre)}» al proceso` };
    case "documento_quitado":
      return { ...base, titulo: `Quitó el documento «${texto(d.nombre)}» del proceso` };
    default:
      return { ...base, titulo: "Hizo un cambio" };
  }
}
