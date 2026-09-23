import "server-only";

/**
 * Registro estructurado: una línea JSON por evento (se lee igual en la
 * terminal, en el log de `next dev` y en los logs de Vercel).
 * Nunca pasar datos personales completos (correo, cédula, celular).
 */
export function registrar(
  nivel: "error" | "warn" | "info",
  datos: { evento: string } & Record<string, unknown>,
) {
  const linea = JSON.stringify({ nivel, momento: new Date().toISOString(), ...datos });
  if (nivel === "error") console.error(linea);
  else if (nivel === "warn") console.warn(linea);
  else console.info(linea);
}
