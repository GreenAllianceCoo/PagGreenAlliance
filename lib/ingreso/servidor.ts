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
export async function dentroDelLimiteDeVerificacion(cedula: string) {
  const ip = await ipDelCliente();
  return (
    (await dentroDelLimite("otp-verificar-ip", ip, LIMITE_VERIFICAR_POR_IP, VENTANA_VERIFICAR_SEGUNDOS)) &&
    (await dentroDelLimite(
      "otp-verificar-cedula",
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

export type DatosIngreso = {
  /** Cédula normalizada. */
  c: string;
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

/** Correo real de la cédula (service role). null si no existe. */
export async function correoDeCedula(cedula: string): Promise<string | null> {
  const { data, error } = await crearClienteAdmin().rpc("correo_por_cedula", { p_cedula: cedula });
  if (error) {
    registrar("error", { evento: "correo_por_cedula_fallo", codigo: error.code, mensaje: error.message });
    return null;
  }
  return typeof data === "string" && data.length > 0 ? data : null;
}

function mascaraDeRelleno(cedula: string) {
  const bytes = createHmac("sha256", llaveSecreta()).update(`relleno:${cedula}`).digest();
  return correoDeRelleno(bytes);
}

async function esperarHasta(inicio: number, minimoMs: number) {
  const falta = minimoMs - (Date.now() - inicio);
  if (falta > 0) await new Promise((resolver) => setTimeout(resolver, falta));
}

/**
 * Envía el código a la cédula si existe y si no se pasó de los límites.
 * SIEMPRE devuelve lo mismo (el correo enmascarado, real o de relleno) y tarda
 * al menos TIEMPO_MINIMO_ENVIO_MS: quien llama no puede saber si la cédula
 * existe, ni si se envió el correo. Nunca lanza.
 */
export async function enviarCodigo(cedula: string): Promise<{ mascara: string }> {
  const inicio = Date.now();
  let mascara = mascaraDeRelleno(cedula);

  try {
    const ip = await ipDelCliente();
    const permitido =
      (await dentroDelLimite("otp-ip", ip, 20, 15 * 60)) &&
      (await dentroDelLimite("otp-cedula-45s", cedula, 1, ESPERA_REENVIO_SEGUNDOS)) &&
      (await dentroDelLimite("otp-cedula", cedula, 5, 15 * 60));

    const correo = await correoDeCedula(cedula);
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
