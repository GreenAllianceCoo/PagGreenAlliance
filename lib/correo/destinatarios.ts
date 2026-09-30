/**
 * A quién le llegan los avisos del asociado (RS-02, decisión de Sebas 30-sep,
 * spec-requerimientos-ricardo §10):
 *  - avisos CON DATOS (afiliación aprobada con cédula, resultado del crédito
 *    con monto y motivo, boleta del sorteo con su número): SOLO al correo
 *    PERSONAL, que sí se verifica porque es el del código de ingreso;
 *  - al correo INSTITUCIONAL (que nunca se verifica y lo controla el
 *    empleador) solo llega un aviso SIN datos: ver `lib/correo/institucional.ts`;
 *  - el código de ingreso: SOLO al personal (lo manda Supabase Auth; este
 *    archivo no lo toca).
 * Funciones puras: normalizan y quitan vacíos.
 */
function normalizar(correo: string | null | undefined): string {
  const limpio = (correo ?? "").trim().toLowerCase();
  return limpio.includes("@") ? limpio : "";
}

/** Destinatarios de un aviso con datos: únicamente el correo personal. */
export function destinatariosAviso(personal: string | null | undefined): string[] {
  const limpio = normalizar(personal);
  return limpio ? [limpio] : [];
}

/**
 * Destinatario del aviso genérico (sin datos): el correo institucional, si
 * existe y es distinto del personal. `null` si no hay a quién avisar.
 */
export function destinatarioAvisoInstitucional(
  personal: string | null | undefined,
  institucional: string | null | undefined,
): string | null {
  const inst = normalizar(institucional);
  if (!inst || inst === normalizar(personal)) return null;
  return inst;
}
