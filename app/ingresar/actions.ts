"use server";

import { registrar } from "@/lib/servidor/registro";
import { redirect } from "next/navigation";
import { erroresPorCampo, textoDe } from "@/lib/validaciones/comunes";
import {
  esquemaCodigo,
  esquemaIngresoCedula,
  leerCodigo,
  MENSAJE_CODIGO_INVALIDO,
} from "@/lib/validaciones/ingreso";
import {
  borrarCookieIngreso,
  correoDeCedula,
  dentroDelLimiteDeVerificacion,
  ESPERA_REENVIO_SEGUNDOS,
  enviarCodigo,
  guardarCookieIngreso,
  leerCookieIngreso,
  MENSAJE_LIMITE_VERIFICACION,
  segundosParaReenviar,
} from "@/lib/ingreso/servidor";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Paso 1 · «Enviarme el código»
// ---------------------------------------------------------------------------

export type EstadoIngresoCedula = {
  error?: string;
  /** Lo que escribió el usuario, para no borrarlo si hay error. */
  cedula?: string;
};

/**
 * Busca la cédula y envía el código. Responde IGUAL exista o no la cédula
 * (mismo destino, mismo mensaje, tiempo mínimo igual). Solo devuelve error
 * si el formato de la cédula no es válido.
 */
export async function enviarCodigoIngreso(
  _previo: EstadoIngresoCedula,
  formData: FormData,
): Promise<EstadoIngresoCedula> {
  const cedulaEscrita = textoDe(formData, "cedula");
  const resultado = esquemaIngresoCedula.safeParse({ cedula: cedulaEscrita });
  if (!resultado.success) {
    const errores = erroresPorCampo<"cedula">(resultado.error);
    return { error: errores.cedula, cedula: cedulaEscrita };
  }

  const { cedula } = resultado.data;
  const { mascara } = await enviarCodigo(cedula);
  await guardarCookieIngreso({ c: cedula, m: mascara, u: Date.now() });
  redirect("/ingresar/codigo");
}

// ---------------------------------------------------------------------------
// Paso 2 · «Entrar a mi cuenta»
// ---------------------------------------------------------------------------

export type EstadoIngresoCodigo = { error?: string };

export async function verificarCodigoIngreso(
  _previo: EstadoIngresoCodigo,
  formData: FormData,
): Promise<EstadoIngresoCodigo> {
  const datos = await leerCookieIngreso();
  if (!datos) redirect("/ingresar");

  const codigo = esquemaCodigo.safeParse(leerCodigo(formData));
  if (!codigo.success) return { error: MENSAJE_CODIGO_INVALIDO };

  // F-02: tope de intentos (por cédula y por IP) antes de gastar un intento
  // real contra Supabase. Se revisa para cédulas registradas y no
  // registradas por igual, así el límite no delata si la cédula existe.
  if (!(await dentroDelLimiteDeVerificacion(datos.c))) {
    return { error: MENSAJE_LIMITE_VERIFICACION };
  }

  const correo = await correoDeCedula(datos.c);
  if (!correo) {
    // Cédula no registrada: mismo mensaje que un código equivocado.
    return { error: MENSAJE_CODIGO_INVALIDO };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: correo,
    token: codigo.data,
    type: "email",
  });
  if (error) {
    registrar("warn", { evento: "otp_verificacion_fallo", estado: error.status, codigo: error.code });
    return { error: MENSAJE_CODIGO_INVALIDO };
  }

  await borrarCookieIngreso();

  // Redirección por rol (admin → /admin, asesor → /asesor, asociado → /cuenta).
  // Si por lo que sea no se puede leer el perfil, se manda a /cuenta (el destino
  // de siempre); /admin y /asesor exigen su propio rol con exigirAdmin() y su
  // equivalente, así que un asociado nunca llega ahí por error.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let destino = "/cuenta";
  if (user) {
    const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
    if (perfil?.rol === "admin") destino = "/admin";
    else if (perfil?.rol === "asesor") destino = "/asesor";
  }
  redirect(destino);
}

// ---------------------------------------------------------------------------
// Paso 2 · «Reenviar código»
// ---------------------------------------------------------------------------

export type EstadoReenvio = {
  /** Mensaje para lectores de pantalla (región aria-live). */
  mensaje?: string;
  /** Segundos que faltan para poder reenviar otra vez. */
  segundos?: number;
  /** Cambia en cada respuesta para reiniciar el contador en el cliente. */
  marca?: number;
};

export async function reenviarCodigoIngreso(): Promise<EstadoReenvio> {
  const datos = await leerCookieIngreso();
  if (!datos) redirect("/ingresar");

  // Validación en servidor del contador de 45 s (el cliente también lo bloquea).
  const faltan = segundosParaReenviar(datos);
  if (faltan > 0) {
    return {
      mensaje: `Espera ${faltan} segundos para pedir otro código.`,
      segundos: faltan,
      marca: Date.now(),
    };
  }

  const { mascara } = await enviarCodigo(datos.c);
  await guardarCookieIngreso({ c: datos.c, m: mascara, u: Date.now() });
  return {
    mensaje: "Si tu cédula está registrada, te enviamos un código nuevo.",
    segundos: ESPERA_REENVIO_SEGUNDOS,
    marca: Date.now(),
  };
}
