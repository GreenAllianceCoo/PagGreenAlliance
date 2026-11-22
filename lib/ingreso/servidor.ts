import "server-only";
import { registrar } from "@/lib/servidor/registro";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { correoDeRelleno, enmascararCorreo } from "@/lib/mascara";
import { crearClienteAdmin, crearClienteAnonimoSinSesion } from "@/lib/supabase/admin";
import { dentroDelLimite, ipDelCliente } from "@/lib/servidor/limite";
// Reexportado para quien ya importaba este mensaje desde aquí (Server Action).
export { MENSAJE_LIMITE_VERIFICACION } from "@/lib/validaciones/ingreso";

/**
 * Ingreso con cédula + código (docs/spec-afiliacion-y-login.md §1).
 *
 * Entre el paso 1 y el paso 2 viaja una cookie httpOnly CIFRADA (AES-256-GCM)
 * con la cédula, el correo ENMASCARADO y la hora del último envío. El correo
 * completo nunca sale del servidor: en el paso 2 se vuelve a buscar con
 * correo_por_cedula().
 */

export const COOKIE_INGRESO = "ga_ingreso";
/** Vida de la cookie del paso 1 → paso 2 (10 min, igual que el código). */
export const VIDA_COOKIE_SEGUNDOS = 10 * 60;
/** Tiempo mínimo entre dos códigos para la misma cédula. */
export const ESPERA_REENVIO_SEGUNDOS = 45;

/**
 * F-02: tope de intentos al VERIFICAR el código (antes no existía: se podían
 * probar códigos sin límite). Dos topes, iguales al patrón que ya usa
 * `enviarCodigo` (otp-ip / otp-cedula), para que un intento equivocado no
 * bloquee de inmediato a alguien que solo se equivocó una vez, pero sí frene
 * la fuerza bruta:
 * - Por cédula: pocos intentos, porque un dueño real del código rara vez se
 *   equivoca más de un par de veces.
 * - Por IP: más intentos, porque una IP compartida (oficina, wifi público)
 *   puede tener varias personas ingresando a la vez.
 * Se cuenta CADA intento (acierte o no), y para cédulas registradas y no
 * registradas por igual: así el límite en sí mismo no delata si la cédula
 * existe (mismo comportamiento, mismo mensaje).
 */
export const LIMITE_VERIFICAR_POR_CEDULA = 5;
export const LIMITE_VERIFICAR_POR_IP = 30;
const VENTANA_VERIFICAR_SEGUNDOS = 15 * 60;

/**
 * true si todavía se puede intentar verificar el código (cédula e IP dentro
 * del tope). Se apoya en `dentroDelLimite` (HMAC + tabla en Supabase, igual
 * que el resto de los límites de esta app). Mismo estilo que `enviarCodigo`:
 * corto circuito con `&&` (si la IP ya está bloqueada no hace falta gastar
 * cupo de la cédula).
 */
export async function dentroDelLimiteDeVerificacion(cedula: string, tipo: TipoIngreso = "cedula") {
  const ip = await ipDelCliente();
  return (
    (await dentroDelLimite("otp-verificar-ip", ip, LIMITE_VERIFICAR_POR_IP, VENTANA_VERIFICAR_SEGUNDOS)) &&
    (await dentroDelLimite(
      `otp-verificar-${tipo}`,
      cedula,
      LIMITE_VERIFICAR_POR_CEDULA,
      VENTANA_VERIFICAR_SEGUNDOS,
    ))
  );
}
/**
 * Tiempo mínimo de respuesta del envío. Iguala el tiempo exista o no la
 * cédula (buscar + enviar tarda más que solo buscar).
 */
const TIEMPO_MINIMO_ENVIO_MS = 1500;

/**
 * Quién ingresa: un asociado (cédula) o una empresa en convenio (NIT,
 * docs/spec-convenios.md §B2). Mismo flujo, misma cookie, mismos límites
 * (con su propia clave por tipo).
 */
export type TipoIngreso = "cedula" | "nit";

export type DatosIngreso = {
  /** Cédula o NIT normalizado (según `t`). */
  c: string;
  /** Tipo de ingreso. Sin `t` = cédula (las cookies anteriores siguen sirviendo). */
  t?: "nit";
  /** Correo enmascarado para mostrar. */
  m: string;
  /** Último envío de código (epoch ms). */
  u: number;
};

function llaveSecreta() {
  const secreto = process.env.INGRESO_COOKIE_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error("Falta INGRESO_COOKIE_SECRET (32+ caracteres) en el servidor.");
  }
  return createHash("sha256").update(secreto).digest();
}

function cifrar(datos: DatosIngreso) {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", llaveSecreta(), iv);
  const cuerpo = Buffer.concat([cifrador.update(JSON.stringify(datos), "utf8"), cifrador.final()]);
  return Buffer.concat([iv, cifrador.getAuthTag(), cuerpo]).toString("base64url");
}

function descifrar(valor: string): DatosIngreso | null {
  try {
    const crudo = Buffer.from(valor, "base64url");
    const iv = crudo.subarray(0, 12);
    const etiqueta = crudo.subarray(12, 28);
    const cuerpo = crudo.subarray(28);
    const descifrador = createDecipheriv("aes-256-gcm", llaveSecreta(), iv);
    descifrador.setAuthTag(etiqueta);
    const texto = Buffer.concat([descifrador.update(cuerpo), descifrador.final()]).toString("utf8");
    const datos = JSON.parse(texto) as DatosIngreso;
    if (typeof datos.c !== "string" || typeof datos.m !== "string" || typeof datos.u !== "number") {
      return null;
    }
    if (datos.t !== undefined && datos.t !== "nit") return null;
    // Vencida (por si el navegador no la borró).
    if (Date.now() - datos.u > VIDA_COOKIE_SEGUNDOS * 1000) return null;
    return datos;
  } catch {
    return null;
  }
}

/** Lee la cookie del paso 1 (sirve en Server Components y Server Actions). */
export async function leerCookieIngreso() {
  const valor = (await cookies()).get(COOKIE_INGRESO)?.value;
  return valor ? descifrar(valor) : null;
}

/** Guarda la cookie del paso 1 (solo en Server Actions / Route Handlers). */
export async function guardarCookieIngreso(datos: DatosIngreso) {
  (await cookies()).set(COOKIE_INGRESO, cifrar(datos), {
    httpOnly: true,
    // En `next dev` (http://localhost) algunos navegadores no guardan cookies
    // `secure`; en producción (https) siempre va con `secure`.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VIDA_COOKIE_SEGUNDOS,
  });
}

export async function borrarCookieIngreso() {
  (await cookies()).delete(COOKIE_INGRESO);
}

/** Segundos que faltan para poder pedir otro código. */
export function segundosParaReenviar(datos: DatosIngreso, ahora = Date.now()) {
  const pasados = Math.floor((ahora - datos.u) / 1000);
  return Math.max(0, ESPERA_REENVIO_SEGUNDOS - pasados);
}

/** Tipo de ingreso guardado en la cookie. */
export function tipoDeIngreso(datos: DatosIngreso): TipoIngreso {
  return datos.t === "nit" ? "nit" : "cedula";
}

/**
 * Correo real de la cédula o del NIT (service role): correo_por_cedula() o
 * correo_por_nit() (solo convenios activos con cuenta). null si no existe.
 */
export async function correoDe(tipo: TipoIngreso, id: string): Promise<string | null> {
  const { data, error } =
    tipo === "nit"
      ? await crearClienteAdmin().rpc("correo_por_nit", { p_nit: id })
      : await crearClienteAdmin().rpc("correo_por_cedula", { p_cedula: id });
  if (error) {
    registrar("error", { evento: `correo_por_${tipo}_fallo`, codigo: error.code, mensaje: error.message });
    return null;
  }
  return typeof data === "string" && data.length > 0 ? data : null;
}

/** Correo real de la cédula (service role). null si no existe. */
export async function correoDeCedula(cedula: string): Promise<string | null> {
  return correoDe("cedula", cedula);
}

function mascaraDeRelleno(id: string, tipo: TipoIngreso) {
  // La cédula conserva su semilla de siempre (misma máscara que antes).
  const semilla = tipo === "nit" ? `relleno:nit:${id}` : `relleno:${id}`;
  const bytes = createHmac("sha256", llaveSecreta()).update(semilla).digest();
  return correoDeRelleno(bytes);
}

async function esperarHasta(inicio: number, minimoMs: number) {
  const falta = minimoMs - (Date.now() - inicio);
  if (falta > 0) await new Promise((resolver) => setTimeout(resolver, falta));
}

/**
 * Envía el código a la cédula (o al NIT, `tipo = "nit"`) si existe y si no se pasó de los límites.
 * SIEMPRE devuelve lo mismo (el correo enmascarado, real o de relleno) y tarda
 * al menos TIEMPO_MINIMO_ENVIO_MS: quien llama no puede saber si la cédula
 * existe, ni si se envió el correo. Nunca lanza.
 */
export async function enviarCodigo(cedula: string, tipo: TipoIngreso = "cedula"): Promise<{ mascara: string }> {
  const inicio = Date.now();
  let mascara = mascaraDeRelleno(cedula, tipo);

  try {
    const ip = await ipDelCliente();
    const permitido =
      (await dentroDelLimite("otp-ip", ip, 20, 15 * 60)) &&
      (await dentroDelLimite(`otp-${tipo}-45s`, cedula, 1, ESPERA_REENVIO_SEGUNDOS)) &&
      (await dentroDelLimite(`otp-${tipo}`, cedula, 5, 15 * 60));

    const correo = await correoDe(tipo, cedula);
    if (correo) {
      mascara = enmascararCorreo(correo);
      if (permitido) {
        const { error } = await crearClienteAnonimoSinSesion().auth.signInWithOtp({
          email: correo,
          options: { shouldCreateUser: false },
        });
        if (error) {
          // Sin datos personales en el registro: solo el código de error.
          registrar("error", {
            evento: "otp_envio_fallo",
            estado: error.status,
            codigo: error.code,
            mensaje: error.message,
          });
        }
      } else {
        registrar("warn", { evento: "otp_limite_alcanzado" });
      }
    }
  } catch (e) {
    registrar("error", { evento: "otp_envio_excepcion", mensaje: e instanceof Error ? e.message : String(e) });
  }

  await esperarHasta(inicio, TIEMPO_MINIMO_ENVIO_MS);
  return { mascara };
}
