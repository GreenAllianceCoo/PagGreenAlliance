/**
 * «Cuenta de nómina» de /afiliacion (spec-requerimientos-ricardo §2.6).
 * La lista vive en la app (la base guarda el texto: 2 a 60 caracteres).
 * Funciones puras: las usa el desplegable (con búsqueda) y el esquema zod.
 */

export const BANCOS = [
  "Bancolombia",
  "Banco de Bogotá",
  "Davivienda",
  "BBVA Colombia",
  "Banco de Occidente",
  "Banco Popular",
  "Banco AV Villas",
  "Banco Caja Social",
  "Scotiabank Colpatria",
  "Banco Agrario",
  "Banco GNB Sudameris",
  "Itaú",
  "Banco Falabella",
  "Banco Pichincha",
  "Bancoomeva",
  "Banco Finandina",
  "Banco Serfinanza",
  "Banco W",
  "Bancamía",
  "Banco Mundo Mujer",
  "Banco Coopcentral",
  "Banco Santander",
  "Banco Contactar",
  "Banco Unión",
  "Mibanco",
  "Ban100",
  "Lulo Bank",
] as const;

/** Billeteras y neobancos: sin tipo de cuenta; el número es el celular (R-03). */
export const BILLETERAS = [
  "Nequi",
  "Daviplata",
  "Nu Colombia",
  "RappiPay",
  "Movii",
  "Dale!",
  "Ualá",
  "Powwi",
] as const;

/** Valor del desplegable para «Otra, ¿cuál?» (se escribe el nombre en `nomina_entidad_otra`). */
export const OPCION_OTRA_ENTIDAD = "otra";
export const ETIQUETA_OTRA_ENTIDAD = "Otra, ¿cuál?";

/** Tipos que la persona elige para un banco (una billetera siempre es depósito electrónico). */
export const TIPOS_CUENTA_BANCO = ["ahorros", "corriente"] as const;
export type TipoCuentaBanco = (typeof TIPOS_CUENTA_BANCO)[number];
/** Valores del enum public.tipo_cuenta_nomina. */
export type TipoCuentaNomina = TipoCuentaBanco | "deposito_electronico";

export const NOMBRE_TIPO_CUENTA: Record<TipoCuentaNomina, string> = {
  ahorros: "Ahorros",
  corriente: "Corriente",
  deposito_electronico: "Depósito electrónico",
};

export type OpcionEntidad = { valor: string; etiqueta: string; grupo: "banco" | "billetera" | "otra" };

/** Opciones del desplegable en el orden de la spec: bancos, billeteras y «Otra, ¿cuál?». */
export const OPCIONES_ENTIDAD: OpcionEntidad[] = [
  ...BANCOS.map((b) => ({ valor: b, etiqueta: b, grupo: "banco" as const })),
  ...BILLETERAS.map((b) => ({ valor: b, etiqueta: b, grupo: "billetera" as const })),
  { valor: OPCION_OTRA_ENTIDAD, etiqueta: ETIQUETA_OTRA_ENTIDAD, grupo: "otra" },
];

export function esBilletera(entidad: string): boolean {
  return (BILLETERAS as readonly string[]).includes(entidad);
}

export function esEntidadDeLista(entidad: string): boolean {
  return (BANCOS as readonly string[]).includes(entidad) || esBilletera(entidad);
}

function sinTildes(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Búsqueda del desplegable: ignora tildes y mayúsculas; «Otra, ¿cuál?» siempre queda al final. */
export function buscarEntidades(texto: string): OpcionEntidad[] {
  const busqueda = sinTildes(texto.trim());
  if (!busqueda) return OPCIONES_ENTIDAD;
  const coincidencias = OPCIONES_ENTIDAD.filter(
    (o) => o.grupo !== "otra" && sinTildes(o.etiqueta).includes(busqueda),
  );
  return [...coincidencias, OPCIONES_ENTIDAD[OPCIONES_ENTIDAD.length - 1]];
}

/** Paso de la cascada que se muestra (entidad → tipo → número; billetera: entidad → número). */
export function pasosCuentaNomina(entidad: string): { pideTipo: boolean; pideNumero: boolean; pideNombreOtra: boolean } {
  if (!entidad) return { pideTipo: false, pideNumero: false, pideNombreOtra: false };
  if (esBilletera(entidad)) return { pideTipo: false, pideNumero: true, pideNombreOtra: false };
  return { pideTipo: true, pideNumero: true, pideNombreOtra: entidad === OPCION_OTRA_ENTIDAD };
}
