"use server";

import { revalidatePath } from "next/cache";
import { registrar } from "@/lib/servidor/registro";
import { exigirAdmin } from "@/lib/admin/servidor";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { erroresPorCampo } from "@/lib/validaciones/comunes";
import {
  esquemaCrearAsesor,
  leerFormularioAsesor,
  type CampoCrearAsesor,
} from "@/lib/validaciones/admin";

export type EstadoCrearAsesor = {
  errores?: Partial<Record<CampoCrearAsesor, string>>;
  /** Error que no es de un campo (correo/cédula duplicados en Auth, falla de la base). */
  errorGeneral?: string;
  mensaje?: string;
  /** Lo que escribió el admin, para no borrarlo si hay error. */
  valores?: ReturnType<typeof leerFormularioAsesor>;
};

/**
 * «Registrar asesor»: crea el usuario en Supabase Auth (mismo mecanismo que
 * un asociado: `auth.admin.createUser` con la cédula en `app_metadata`) y
 * luego, con la sesión del admin, cambia su rol a `asesor` (handle_new_user
 * siempre crea el perfil como `asociado`; el cambio de rol solo lo puede
 * hacer un admin autenticado, por RLS).
 */
export async function crearAsesor(
  _previo: EstadoCrearAsesor,
  formData: FormData,
): Promise<EstadoCrearAsesor> {
  const { supabase } = await exigirAdmin();

  const entrada = leerFormularioAsesor(formData);
  const resultado = esquemaCrearAsesor.safeParse(entrada);
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoCrearAsesor>(resultado.error), valores: entrada };
  }
  const datos = resultado.data;
  const nombreCompleto = `${datos.nombres} ${datos.apellidos}`;

  const admin = crearClienteAdmin();

  const { data: existente } = await admin.from("perfiles").select("id").eq("cedula", datos.cedula).maybeSingle();
  if (existente) {
    return { errores: { cedula: "Ya existe una cuenta con esta cédula." }, valores: entrada };
  }

  const { data: creado, error } = await admin.auth.admin.createUser({
    email: datos.correo,
    email_confirm: true,
    app_metadata: { cedula: datos.cedula },
    user_metadata: { nombre_completo: nombreCompleto },
  });
  if (error || !creado?.user) {
    registrar("error", { evento: "crear_asesor_usuario_fallo", mensaje: error?.message });
    return {
      errorGeneral: "No pudimos crear el asesor. Revisa que el correo no esté ya registrado.",
      valores: entrada,
    };
  }

  // GoTrue guarda app_metadata después del insert: handle_new_user deja la
  // cédula en «PENDIENTE-…». Se fija aquí para que el asesor pueda ingresar.
  const { error: errorCedula } = await admin.from("perfiles").update({ cedula: datos.cedula }).eq("id", creado.user.id);
  if (errorCedula) {
    registrar("error", { evento: "crear_asesor_cedula_fallo", mensaje: errorCedula.message });
    return {
      errorGeneral: "Creamos la cuenta, pero no pudimos guardar su cédula. Avisa al equipo técnico.",
      valores: entrada,
    };
  }

  const { error: errorRol } = await supabase.from("perfiles").update({ rol: "asesor" }).eq("id", creado.user.id);
  if (errorRol) {
    registrar("error", { evento: "crear_asesor_rol_fallo", mensaje: errorRol.message });
    return {
      errorGeneral: "Creamos la cuenta, pero no pudimos asignarle el rol de asesor. Avisa al equipo técnico.",
      valores: entrada,
    };
  }

  revalidatePath("/admin/asesores");
  return { mensaje: `Asesor «${nombreCompleto}» creado.` };
}
