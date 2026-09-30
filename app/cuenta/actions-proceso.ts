"use server";

/**
 * «Retiro anticipado» → «Avisar al administrador» y «Renovar los 36 meses»
 * de /cuenta «Perfil» (spec-requerimientos-ricardo §3.8–§3.9, pieza 3k).
 * La RPC `crear_alerta_asociado` (migración 20260929100400) decide todo:
 * proceso en «operando», plazos (R-05/R-06) y una sola alerta pendiente por
 * tipo. Después se avisa por correo a los admins (`correos_admins()`).
 * Ninguna de las dos devuelve sumas: el cobro de $10.000.000 es un texto
 * fijo del modal (TEXTO_COBRO_RETIRO_ANTICIPADO), no un cálculo.
 */
import { revalidatePath } from "next/cache";
import { avisarAdminsDeAlerta, type TipoAlertaAsociado } from "@/lib/correo/alertas";
import { asociadoActivo } from "@/lib/asociado/activo";
import { MENSAJE_CUENTA_INACTIVA } from "@/lib/asociado/inactivo";
import { MENSAJE_ALERTA_ENVIADA } from "@/lib/procesoEjecutivo";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";

export type EstadoAlertaAsociado = {
  ok?: boolean;
  /** «Listo, el administrador te contactará». */
  mensaje?: string;
  error?: string;
};

const MENSAJE_SIN_SESION = "Tu sesión venció. Vuelve a ingresar.";
const MENSAJE_GENERICO = "No pudimos avisar al administrador. Intenta de nuevo.";

/** Textos de `raise exception` de crear_alerta_asociado() que ya están listos para mostrar. */
const MENSAJES_DE_LA_BASE = [
  "Esta opción se habilita cuando tu proceso esté operando",
  "Tu conteo de 36 meses ya terminó",
  "La renovación se habilita cuando pasen 24 meses desde el inicio de tu embargo",
  "Ya avisaste al administrador; te contactará pronto",
];

async function crearAlertaAsociado(tipo: TipoAlertaAsociado): Promise<EstadoAlertaAsociado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: MENSAJE_SIN_SESION };
  // §12.6: un asociado dado de baja no crea alertas (la base también lo bloquea).
  if (!(await asociadoActivo(supabase, user.id))) return { error: MENSAJE_CUENTA_INACTIVA };

  const { error } = await supabase.rpc("crear_alerta_asociado", { p_tipo: tipo });
  if (error) {
    const conocido = MENSAJES_DE_LA_BASE.find((m) => error.message?.includes(m));
    if (!conocido) registrar("error", { evento: "alerta_asociado_fallo", tipo, codigo: error.code, mensaje: error.message });
    return { error: conocido ? `${conocido}.` : MENSAJE_GENERICO };
  }

  const { data: perfil } = await supabase.from("perfiles").select("nombre_completo").eq("id", user.id).single();
  await avisarAdminsDeAlerta({ tipo, nombreAsociado: perfil?.nombre_completo ?? "Un asociado" });

  revalidatePath("/cuenta");
  revalidatePath("/cuenta/perfil");
  return { ok: true, mensaje: MENSAJE_ALERTA_ENVIADA };
}

/** Botón «Avisar al administrador» del modal de retiro anticipado (useActionState). */
export async function pedirRetiroAnticipado(): Promise<EstadoAlertaAsociado> {
  return crearAlertaAsociado("retiro_anticipado");
}

/** Confirmación de «Renovar los 36 meses» (useActionState). */
export async function pedirRenovacion(): Promise<EstadoAlertaAsociado> {
  return crearAlertaAsociado("renovacion");
}
