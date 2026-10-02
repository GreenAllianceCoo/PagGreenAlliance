/**
 * Las 7 secciones del panel de administración (pieza 2d/3e–3h): mismo orden
 * en el menú lateral de escritorio, en las pestañas de celular y en el
 * encabezado propio de /admin/demo.
 */
export const SECCIONES = [
  // Pieza 3r (4.7): dashboard «Resumen de clientes» en /admin.
  { href: "/admin", etiqueta: "Resumen", clave: "resumen" },
  { href: "/admin/afiliaciones", etiqueta: "Afiliaciones", clave: "afiliaciones" },
  { href: "/admin/creditos", etiqueta: "Créditos", clave: "creditos" },
  // Pieza 3m: «Asociados» (proceso ejecutivo) y «Alertas» (retiro/renovación).
  { href: "/admin/asociados", etiqueta: "Asociados", clave: "asociados" },
  { href: "/admin/asesores", etiqueta: "Asesores", clave: "asesores" },
  { href: "/admin/alertas", etiqueta: "Alertas", clave: "alertas" },
  { href: "/admin/convenios", etiqueta: "Convenios", clave: "convenios" },
  { href: "/admin/sorteo", etiqueta: "Sorteo", clave: "sorteo" },
  { href: "/admin/demo", etiqueta: "Demostración", clave: "demo" },
] as const;

export type Seccion = (typeof SECCIONES)[number]["clave"];

/** Lo único que ve un secretario en el menú (el servidor además rechaza el resto). */
export const SECCIONES_SECRETARIO: readonly Seccion[] = ["resumen", "afiliaciones"];

/** Secciones que muestra el menú según el rol. */
export function seccionesDelRol(rol: "admin" | "secretario") {
  return rol === "secretario" ? SECCIONES.filter((s) => SECCIONES_SECRETARIO.includes(s.clave)) : SECCIONES;
}
