"use server";

/**
 * Server Actions del «Sorteo del mes» en /cuenta (docs/spec-fase-2.md §4).
 * Ambas exigen sesión y llaman a las funciones SECURITY DEFINER de la base
 * (participar_sorteo / confirmar_boleta_sorteo) con el cliente de
 * service_role, tal como pide la spec (esas funciones NO tienen grant para
 * `authenticated`). La sesión se verifica primero con el cliente normal
 * (cookies), igual que el resto de /cuenta.
 */
import { revalidatePath } from "next/cache";
import { registrar } from "@/lib/servidor/registro";
import { enviarBoletaSorteo } from "@/lib/correo/sorteo";
import { enmascararCorreo } from "@/lib/mascara";
import { fechaBogota, nombreMes } from "@/lib/sorteo/fecha";
import { createClient } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { esquemaNumeroBoleta, leerNumeroBoleta, MENSAJE_NUMERO_BOLETA_INVALIDO } from "@/lib/validaciones/sorteo";

/** Debe coincidir con `v_max_intentos` de confirmar_boleta_sorteo() en la migración. */
const MAX_INTENTOS_CONFIRMACION = 5;

const MENSAJE_ERROR_GENERICO = "No pudimos registrarte en el sorteo. Intenta de nuevo.";
const MENSAJE_SIN_SESION = "Tu sesión venció. Vuelve a ingresar.";

/** Traduce los `raise exception` de participar_sorteo() a un texto ya listo para mostrar. */
function mensajeParticiparSorteo(mensajeBD?: string) {
  if (mensajeBD?.includes("solo está abierta del 1 al 5")) {
    return "La inscripción al sorteo solo está abierta del 1 al 5 de cada mes.";
  }
  if (mensajeBD?.includes("Ya tienes una boleta")) {
    return "Ya tienes una boleta para el sorteo de este mes.";
  }
  return MENSAJE_ERROR_GENERICO;
}

/** Traduce los `raise exception` de confirmar_boleta_sorteo() (sin decir "intentos agotados"). */
function mensajeConfirmarSorteo(mensajeBD?: string) {
  if (mensajeBD?.includes("ya cerró")) return "La ventana del sorteo (1 al 5) ya cerró.";
  if (mensajeBD?.includes("No tienes una boleta")) return "No tienes una boleta para el sorteo de este mes.";
  // Incluye el tope de intentos: mensaje genérico a propósito (spec-fase-2.md §4).
  return "No pudimos confirmar tu boleta. Intenta más tarde o habla con la cooperativa.";
}

export type EstadoParticiparSorteo = {
  ok?: boolean;
  error?: string;
  /** Correo enmascarado para el paso 2 del modal («Te enviamos tu boleta a ju•••@po•••.co»). */
  correoEnmascarado?: string;
};

/**
 * Paso 1 del modal: «Quiero participar». Genera la boleta (RPC) y la envía
 * por correo; NUNCA devuelve el número al navegador.
 */
export async function participarSorteo(): Promise<EstadoParticiparSorteo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: MENSAJE_SIN_SESION };

  const correo = user.email;
  if (!correo) {
    registrar("error", { evento: "sorteo_participar_sin_correo" });
    return { error: MENSAJE_ERROR_GENERICO };
  }

  const { data: perfil } = await supabase.from("perfiles").select("nombre_completo").eq("id", user.id).single();
  const nombre = perfil?.nombre_completo ?? "Asociado";

  const { data, error } = await crearClienteAdmin().rpc("participar_sorteo", { p_asociado_id: user.id });
  if (error || !data || data.length === 0) {
    registrar("warn", { evento: "sorteo_participar_fallo", mensaje: error?.message });
    return { error: mensajeParticiparSorteo(error?.message) };
  }

  const fila = data[0] as { numero: string; mes: number };
  await enviarBoletaSorteo({ correo, nombre, numero: fila.numero, mes: nombreMes(fila.mes) });

  revalidatePath("/cuenta");
  return { ok: true, correoEnmascarado: enmascararCorreo(correo) };
}

export type EstadoConfirmarSorteo = {
  ok?: boolean;
  error?: string;
  /** Solo se llena cuando `ok` (para el paso 3, «celebración»). */
  numero?: string;
  /** Solo se llena cuando el número escrito NO coincidió. */
  intentosRestantes?: number;
};

/** Paso 2 del modal: compara el número escrito por el asociado. */
export async function confirmarBoletaSorteo(
  _previo: EstadoConfirmarSorteo,
  formData: FormData,
): Promise<EstadoConfirmarSorteo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: MENSAJE_SIN_SESION };

  const resultado = esquemaNumeroBoleta.safeParse(leerNumeroBoleta(formData));
  if (!resultado.success) return { error: MENSAJE_NUMERO_BOLETA_INVALIDO };

  const { anio, mes } = fechaBogota();

  let coincide: boolean;
  try {
    const { data, error } = await crearClienteAdmin().rpc("confirmar_boleta_sorteo", {
      p_asociado_id: user.id,
      p_numero: resultado.data,
    });
    if (error) throw error;
    coincide = Boolean(data);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    registrar("warn", { evento: "sorteo_confirmar_fallo", mensaje });
    return { error: mensajeConfirmarSorteo(mensaje) };
  }

  if (!coincide) {
    // El número no coincidió: la RPC ya sumó el intento en la base; se relee
    // para avisar cuántos quedan (RLS: el asociado solo puede ver su fila).
    const { data: fila } = await supabase
      .from("boletas_sorteo")
      .select("intentos")
      .eq("anio", anio)
      .eq("mes", mes)
      .maybeSingle();
    const intentos = fila?.intentos ?? 0;
    return {
      error: "El número no coincide con tu boleta.",
      intentosRestantes: Math.max(0, MAX_INTENTOS_CONFIRMACION - intentos),
    };
  }

  const { data: fila } = await supabase
    .from("boletas_sorteo")
    .select("numero")
    .eq("anio", anio)
    .eq("mes", mes)
    .maybeSingle();

  revalidatePath("/cuenta");
  return { ok: true, numero: fila?.numero };
}
