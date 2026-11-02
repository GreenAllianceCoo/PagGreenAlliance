import { interpolarPorcentaje } from "@/lib/credito";
import type { CodigoGrado, PaqueteDemo } from "@/lib/asesor/datosDemo";

/**
 * Tope del paquete (grado + porcentaje) para el aviso «Dentro/Supera el
 * tope». `paquetesPorGrado` viene de `cargarPaquetesDemo` (la página de
 * servidor), que lee los topes reales de `grados_credito`; si esa consulta
 * falla no hay copia de respaldo (RS-08) y el aviso no se muestra. Así el aviso —y el bloqueo de «Aprobar» que depende de
 * él— usa el tope vigente de verdad, no una copia que puede desactualizarse.
 * De todos modos, aunque la UI se equivocara, el servidor (trigger
 * `chk_monto_solicitud` + `validar_monto_solicitud`) es quien de verdad
 * impide guardar un monto sobre el tope: esto es solo el aviso visual.
 * Lo usan la ficha y la vista de tabla de /admin/creditos.
 */
export function topeDelPaquete(
  paquetesPorGrado: Partial<Record<CodigoGrado, PaqueteDemo[]>>,
  grado: string,
  porcentaje: number,
): number | undefined {
  const paquetes = paquetesPorGrado[grado as CodigoGrado];
  const cupo50 = paquetes?.find((p) => p.porcentaje === "50")?.capacidad_maxima;
  const cupo100 = paquetes?.find((p) => p.porcentaje === "100")?.capacidad_maxima;
  if (cupo50 === undefined || cupo100 === undefined) return undefined;
  // Entre 50 % y 100 % el cupo se interpola; solo es un aviso (el admin puede superarlo).
  return Math.round(interpolarPorcentaje(cupo50, cupo100, porcentaje));
}

/**
 * Situación de un crédito frente al tope, con la misma regla de la ficha:
 * superarlo solo bloquea «Aprobar» si nadie lo decidió; al editar las
 * condiciones, el admin lo autoriza con su motivo (`condiciones_editadas_at`).
 */
export function situacionTope(
  paquetesPorGrado: Partial<Record<CodigoGrado, PaqueteDemo[]>>,
  fila: { grado: string; porcentaje_credito: number; monto_solicitado: number; condiciones_editadas_at: string | null },
) {
  const tope = topeDelPaquete(paquetesPorGrado, fila.grado, fila.porcentaje_credito);
  const dentroDelTope = tope !== undefined ? fila.monto_solicitado <= tope : undefined;
  const autorizadoSobreTope = dentroDelTope === false && Boolean(fila.condiciones_editadas_at);
  return { tope, dentroDelTope, autorizadoSobreTope, bloqueaAprobar: dentroDelTope === false && !autorizadoSobreTope };
}
