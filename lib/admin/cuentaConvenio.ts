import "server-only";
import { avisarAccesoConvenio } from "@/lib/correo/convenio";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export const MENSAJE_CORREO_OCUPADO = "Ese correo ya tiene otra cuenta en Green Alliance. Usa otro correo de acceso.";
const MENSAJE_FALLO = "No pudimos crear el acceso. Intenta de nuevo.";

/** Cuenta actual del convenio (de convenio_cuentas), si ya tiene. */
export type CuentaActual = { usuarioId: string; correo: string } | null;

type Resultado = { ok: true; cambio: boolean } | { ok: false; mensaje: string };

function esCorreoOcupado(error: { code?: string; status?: number; message?: string }) {
  return error.code === "email_exists" || error.code === "user_already_exists" || /already (been )?registered/i.test(error.message ?? "");
}

/**
 * Crea o actualiza la cuenta de Auth de una empresa en convenio
 * (docs/spec-convenios.md §B2). Service role, solo desde una Server Action que
 * ya pasó por exigirAdmin().
 *
 * - Mismo correo que ya tiene → no hace nada.
 * - Ya tiene cuenta → cambia el correo de esa cuenta (confirmado, sin contraseña).
 * - Sin cuenta → crea el usuario (confirmado, sin contraseña).
 * Después vincula con vincular_cuenta_convenio(), que nunca convierte a un
 * asociado real (si el correo ya es de otra persona, error). Si el vínculo de
 * una cuenta recién creada falla, la borra. Al terminar envía el correo «Ya
 * puedes publicar» (no bloquea).
 */
export async function asegurarCuentaConvenio(datos: {
  convenioId: string;
  nombre: string;
  correo: string;
  actual: CuentaActual;
}): Promise<Resultado> {
  const { convenioId, nombre, correo, actual } = datos;
  if (actual && actual.correo === correo) return { ok: true, cambio: false };

  const admin = crearClienteAdmin();
  let usuarioId: string;
  let creada = false;

  if (actual) {
    const { error } = await admin.auth.admin.updateUserById(actual.usuarioId, { email: correo, email_confirm: true });
    if (error) {
      if (esCorreoOcupado(error)) return { ok: false, mensaje: MENSAJE_CORREO_OCUPADO };
      registrar("error", { evento: "convenio_cuenta_correo_fallo", convenio_id: convenioId, codigo: error.code, estado: error.status });
      return { ok: false, mensaje: MENSAJE_FALLO };
    }
    usuarioId = actual.usuarioId;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: correo,
      email_confirm: true,
      user_metadata: { nombre_completo: nombre },
    });
    if (error || !data.user) {
      if (error && esCorreoOcupado(error)) return { ok: false, mensaje: MENSAJE_CORREO_OCUPADO };
      registrar("error", { evento: "convenio_cuenta_crear_fallo", convenio_id: convenioId, codigo: error?.code, estado: error?.status });
      return { ok: false, mensaje: MENSAJE_FALLO };
    }
    usuarioId = data.user.id;
    creada = true;
  }

  const { error: errorVinculo } = await admin.rpc("vincular_cuenta_convenio", {
    p_convenio: convenioId,
    p_usuario: usuarioId,
    p_correo: correo,
  });
  if (errorVinculo) {
    registrar("error", { evento: "convenio_cuenta_vincular_fallo", convenio_id: convenioId, codigo: errorVinculo.code });
    if (creada) {
      const { error: errorBorrado } = await admin.auth.admin.deleteUser(usuarioId);
      if (errorBorrado) registrar("error", { evento: "convenio_cuenta_huerfana", convenio_id: convenioId, codigo: errorBorrado.code });
    }
    // 23505: el correo ya está en otra cuenta de convenio.
    if (errorVinculo.code === "23505" || errorVinculo.code === "P0001") return { ok: false, mensaje: MENSAJE_CORREO_OCUPADO };
    return { ok: false, mensaje: MENSAJE_FALLO };
  }

  registrar("info", { evento: creada ? "convenio_cuenta_creada" : "convenio_cuenta_correo_cambiado", convenio_id: convenioId });
  await avisarAccesoConvenio({ convenioId, nombre, correo });
  return { ok: true, cambio: true };
}
