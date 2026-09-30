import "server-only";
import { enviarCorreoTexto } from "@/lib/correo/resend";
import { registrar } from "@/lib/servidor/registro";
import { urlDelSitio } from "@/lib/servidor/sitio";
import { crearClienteAdmin } from "@/lib/supabase/admin";

import { ETIQUETA_ALERTA, type TipoAlertaAsociado } from "@/lib/alertasAsociado";

export type { TipoAlertaAsociado };

/**
 * Aviso por correo a los admins de una alerta nueva del asociado
 * (spec-requerimientos-ricardo §3.8–§3.9). Los correos salen de
 * `correos_admins()` (solo service_role). Es un aviso INTERNO de texto
 * simple: no usa las plantillas de asociados. Si falla, se registra y la
 * alerta igual queda en la base (la bandeja /admin/alertas la muestra).
 */
export async function avisarAdminsDeAlerta(datos: { tipo: TipoAlertaAsociado; nombreAsociado: string }) {
  try {
    const { data, error } = await crearClienteAdmin().rpc("correos_admins");
    if (error) throw error;
    const correos = ((data ?? []) as { correo: string | null }[])
      .map((f) => (f.correo ?? "").trim().toLowerCase())
      .filter((c) => c.includes("@"));
    if (correos.length === 0) {
      registrar("warn", { evento: "alerta_admin_sin_destinatarios", tipo: datos.tipo });
      return;
    }
    const etiqueta = ETIQUETA_ALERTA[datos.tipo];
    await enviarCorreoTexto({
      para: [...new Set(correos)],
      asunto: `Nueva alerta: ${etiqueta.toLowerCase()} · ${datos.nombreAsociado}`,
      texto: [
        `${datos.nombreAsociado} pidió «${etiqueta}» desde su cuenta.`,
        "",
        `Revísala y márcala como atendida en ${await urlDelSitio("/admin/alertas")}`,
        "",
        "Cooperativa Green Alliance",
      ].join("\n"),
    });
  } catch (e) {
    registrar("error", {
      evento: "alerta_admin_correo_fallo",
      tipo: datos.tipo,
      mensaje: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
    });
  }
}
