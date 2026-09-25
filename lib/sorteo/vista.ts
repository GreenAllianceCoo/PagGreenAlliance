/**
 * Cómo `/cuenta` (Server Component) arma lo que ve el modal del sorteo a
 * partir de la fila de `boletas_sorteo` del mes (o `null` si el asociado
 * todavía no participa). Función pura para poder probarla sin Supabase.
 */
import { mesSorteoActual, textoProximaApertura, ventanaSorteoAbierta } from "./fecha";

export type EstadoBoletaSorteo = "sin-participar" | "enviada" | "confirmada";

/**
 * Fila que devuelve `mi_boleta_sorteo()` (F2-01, migración 20260924000600):
 * `numero` ya viene null del servidor cuando la boleta sigue "enviada" (antes
 * de confirmar). Esta función solo decide qué pasa a las props del cliente.
 */
export type FilaBoletaSorteo = { estado: "enviada" | "confirmada"; numero: string | null } | null;

export type SorteoProps = {
  ventanaAbierta: boolean;
  mesTexto: string;
  textoProximaApertura: string;
  estadoInicial: EstadoBoletaSorteo;
  /**
   * Solo tiene valor cuando `estadoInicial === "confirmada"`: es la única
   * situación en la que ya es seguro mostrar el número (el asociado ya lo
   * escribió para confirmarlo). Con `estadoInicial === "enviada"` la fila SÍ
   * tiene un número en la base, pero esta función nunca lo deja pasar a las
   * props del cliente.
   */
  numeroInicial: string | null;
};

export function vistaSorteo(fila: FilaBoletaSorteo, ahora: Date = new Date()): SorteoProps {
  const estadoInicial: EstadoBoletaSorteo = fila?.estado ?? "sin-participar";
  return {
    ventanaAbierta: ventanaSorteoAbierta(ahora),
    mesTexto: mesSorteoActual(ahora),
    textoProximaApertura: textoProximaApertura(ahora),
    estadoInicial,
    numeroInicial: estadoInicial === "confirmada" && fila ? (fila.numero ?? null) : null,
  };
}
