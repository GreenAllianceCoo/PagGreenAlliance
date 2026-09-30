/**
 * Misma regla que public.puede_atender() (migración 20260929100000): puede
 * tener clientes quien tiene rol asesor, o rol admin con `atiende_asociados`;
 * en ambos casos activo. Pura: la usa el servidor y se prueba sola.
 */
export function puedeAtender(
  perfil: { rol?: string | null; atiende_asociados?: boolean | null; activo?: boolean | null } | null,
): boolean {
  if (!perfil || perfil.activo === false) return false;
  return perfil.rol === "asesor" || (perfil.rol === "admin" && perfil.atiende_asociados === true);
}
